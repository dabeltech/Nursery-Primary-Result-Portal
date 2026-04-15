const express = require('express');
const router = express.Router();
const db = require('../database');

function calculateGrade(total) {
  if (total >= 75) return { grade: 'A1', remark: 'Excellent' };
  if (total >= 70) return { grade: 'B2', remark: 'Very Good' };
  if (total >= 65) return { grade: 'B3', remark: 'Good' };
  if (total >= 60) return { grade: 'C4', remark: 'Credit' };
  if (total >= 55) return { grade: 'C5', remark: 'Credit' };
  if (total >= 50) return { grade: 'C6', remark: 'Credit' };
  if (total >= 45) return { grade: 'D7', remark: 'Pass' };
  if (total >= 40) return { grade: 'E8', remark: 'Pass' };
  return { grade: 'F9', remark: 'Fail' };
}

// Check result by PIN + Admission Number
router.post('/check', (req, res) => {
  const { pin, admission_number } = req.body;

  if (!pin || !admission_number) {
    return res.status(400).json({ success: false, message: 'PIN and Admission Number are required.' });
  }

  const pinRecord = db.prepare(`
    SELECT p.*, s.name, s.class, s.admission_number, s.gender, s.date_of_birth
    FROM pins p
    JOIN students s ON p.student_id = s.id
    WHERE p.pin = ? AND s.admission_number = ?
  `).get(pin.trim().toUpperCase(), admission_number.trim().toUpperCase());

  if (!pinRecord) {
    return res.status(404).json({ success: false, message: 'Invalid PIN or Admission Number. Please check and try again.' });
  }

  const results = db.prepare(`
    SELECT * FROM results
    WHERE student_id = ? AND session = ? AND term = ?
    ORDER BY subject
  `).all(pinRecord.student_id, pinRecord.session, pinRecord.term);

  if (results.length === 0) {
    return res.status(404).json({ success: false, message: 'No results found for this student. Please contact your school.' });
  }

  // Calculate class position
  const classPositions = db.prepare(`
    SELECT student_id, SUM(total) AS grand_total
    FROM results
    WHERE session = ? AND term = ? AND class = ?
    GROUP BY student_id
    ORDER BY grand_total DESC
  `).all(pinRecord.session, pinRecord.term, pinRecord.class);

  const position = classPositions.findIndex(r => r.student_id === pinRecord.student_id) + 1;
  const totalInClass = classPositions.length;
  const grandTotal = results.reduce((sum, r) => sum + (r.total || 0), 0);
  const average = grandTotal / results.length;

  // Recalculate grades (ensure correctness)
  const processedResults = results.map(r => {
    const { grade, remark } = calculateGrade(r.total);
    return { ...r, grade, remark };
  });

  // Get school settings
  const settings = {};
  db.prepare('SELECT key, value FROM school_settings').all().forEach(s => {
    settings[s.key] = s.value;
  });

  // Get affective & psychomotor ratings
  const ratingRows = db.prepare(
    'SELECT type, trait, rating FROM student_ratings WHERE student_id = ? AND session = ? AND term = ?'
  ).all(pinRecord.student_id, pinRecord.session, pinRecord.term);

  const affective   = {};
  const psychomotor = {};
  ratingRows.forEach(r => {
    if (r.type === 'affective')   affective[r.trait]   = r.rating;
    if (r.type === 'psychomotor') psychomotor[r.trait] = r.rating;
  });

  // Mark PIN as used (first time only)
  if (!pinRecord.is_used) {
    db.prepare('UPDATE pins SET is_used = 1, used_at = CURRENT_TIMESTAMP WHERE id = ?').run(pinRecord.id);
  }

  res.json({
    success: true,
    ratings: { affective, psychomotor },
    student: {
      name: pinRecord.name,
      admission_number: pinRecord.admission_number,
      class: pinRecord.class,
      gender: pinRecord.gender,
      date_of_birth: pinRecord.date_of_birth,
      session: pinRecord.session,
      term: pinRecord.term
    },
    results: processedResults,
    summary: {
      grand_total: parseFloat(grandTotal.toFixed(1)),
      average: parseFloat(average.toFixed(1)),
      position,
      total_in_class: totalInClass,
      subjects_offered: results.length
    },
    settings
  });
});

module.exports = router;
