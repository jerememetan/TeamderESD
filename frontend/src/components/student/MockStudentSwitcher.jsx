import styles from "./MockStudentSwitcher.module.css";

function MockStudentSwitcher({ activeStudentId, availableStudents, onChange }) {
  return (
    <label className={styles.switcher}>
      <span className={styles.label}>Viewing as</span>
      <select value={activeStudentId} onChange={(event) => onChange(event.target.value)} className={styles.select}>
        {availableStudents.map((student) => (
          <option key={student.id} value={student.id}>
            {student.name || student.studentId} ({student.studentId})
          </option>
        ))}
      </select>
    </label>
  );
}

export default MockStudentSwitcher;
