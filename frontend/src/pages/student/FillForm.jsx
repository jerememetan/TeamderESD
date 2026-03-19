import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import ModuleBlock from "../../components/schematic/ModuleBlock";
import SystemTag from "../../components/schematic/SystemTag";
import { currentStudent, currentStudentTeams, mockCourses, mockForms, mockStudents } from "../../data/mockData";
import styles from "./FillForm.module.css";

function FillForm() {
  const { formId } = useParams();
  const navigate = useNavigate();
  const studentProfile = currentStudent;
  const teamAssignments = currentStudentTeams;
  const availableFormList = Object.values(mockForms);
  const buddyCandidateList = mockStudents.filter((student) => student.id !== studentProfile.id);
  const selectedForm = availableFormList.find((form) => form.id === formId) || mockForms[formId || ""] || availableFormList[0];
  const [responses, setResponses] = useState({});
  const [buddyRequestStudentId, setBuddyRequestStudentId] = useState("");
  const selectedCourse = mockCourses.find((course) => course.id === selectedForm?.courseId);
  const selectedGroup = selectedCourse?.groups.find((group) => group.id === selectedForm?.groupId);
  const activeTeam = teamAssignments.find((team) => team.groupId === selectedForm?.groupId) || teamAssignments[0];

  if (!selectedForm) {
    return <div className={styles.notFound}>Form not found</div>;
  }

  const handleSubmit = (event) => {
    event.preventDefault();
    console.log("Form responses:", {
      studentId: studentProfile.id,
      formId: selectedForm.id,
      responses,
      buddyRequestStudentId: selectedForm.allowBuddy ? buddyRequestStudentId : null,
    });
    alert("Form submitted successfully!");
    navigate("/student");
  };

  return (
    <div className={styles.page}>
      <Link to="/student" className={styles.backLink}><ArrowLeft className={styles.backIcon} /> Return to student console</Link>
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>[GROUP FORM]</p>
          <h2 className={styles.title}>{selectedGroup?.code || activeTeam?.groupId} form</h2>
          <p className={styles.subtitle}>Complete this form for your team in {selectedGroup?.code || activeTeam?.groupId}.</p>
        </div>
        <SystemTag tone="success">Form open</SystemTag>
      </section>

      <form onSubmit={handleSubmit} className={styles.form}>
        {selectedForm.criteria.map((criterion, index) => (
          <ModuleBlock key={criterion.id} componentId={`MOD-R${index + 1}`} eyebrow={`Criterion ${String(index + 1).padStart(2, '0')}`} title={criterion.question}>
            <div className={styles.scaleGrid}>
              {[1, 2, 3, 4, 5].map((score) => (
                <label key={score} className={`${styles.scoreCard} ${responses[criterion.id] === score ? styles.scoreCardActive : ''}`}>
                  <input
                    type="radio"
                    name={criterion.id}
                    value={score}
                    checked={responses[criterion.id] === score}
                    onChange={() => setResponses((currentResponses) => ({ ...currentResponses, [criterion.id]: score }))}
                    className={styles.hiddenInput}
                    required
                  />
                  <span className={styles.scoreValue}>{score}</span>
                  <span className={styles.scoreLabel}>Signal</span>
                </label>
              ))}
            </div>
          </ModuleBlock>
        ))}

        {selectedForm.allowBuddy ? (
          <ModuleBlock componentId="MOD-RB" eyebrow="Pairing Request" title="Buddy request">
            <select value={buddyRequestStudentId} onChange={(event) => setBuddyRequestStudentId(event.target.value)} className={styles.select}>
              <option value="">No buddy request</option>
              {buddyCandidateList.map((student) => (
                <option key={student.id} value={student.id}>{student.name}</option>
              ))}
            </select>
          </ModuleBlock>
        ) : null}

        <div className={styles.actionRow}>
          <button type="submit" className={styles.primaryButton}>Submit form</button>
          <button type="button" onClick={() => navigate('/student')} className={styles.secondaryButton}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

export default FillForm;
