import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import ModuleBlock from "../../components/schematic/ModuleBlock";
import SystemTag from "../../components/schematic/SystemTag";
import { getBackendSectionId } from "../../data/backendIds";
import { currentStudent, currentStudentTeams, mockCourses, mockForms, mockStudents } from "../../data/mockData";
import styles from "./FillForm.module.css";

const STUDENT_FORM_API_BASE =
  import.meta.env.VITE_STUDENT_FORM_API_BASE || "http://localhost:3015/student-form";

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
  const [templateFields, setTemplateFields] = useState([]);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const selectedCourse = mockCourses.find((course) => course.id === selectedForm?.courseId);
  const selectedGroup = selectedCourse?.groups.find((group) => group.id === selectedForm?.groupId);
  const activeTeam = teamAssignments.find((team) => team.groupId === selectedForm?.groupId) || teamAssignments[0];
  const backendSectionId = getBackendSectionId(selectedForm?.groupId || "");
  const sectionId = useMemo(() => backendSectionId || selectedForm?.groupId || formId, [backendSectionId, selectedForm?.groupId, formId]);

  if (!selectedForm) {
    return <div className={styles.notFound}>Form not found</div>;
  }

  useEffect(() => {
    const loadTemplate = async () => {
      if (!sectionId) return;
      setLoadingTemplate(true);
      try {
        const response = await fetch(
          `${STUDENT_FORM_API_BASE}/template?section_id=${encodeURIComponent(sectionId)}`,
        );
        if (!response.ok) return;
        const payload = await response.json();
        const fields = payload?.data?.fields;
        if (Array.isArray(fields)) {
          setTemplateFields(fields);
        }
      } catch (_error) {
        // Keep mock fallback if service is unavailable.
      } finally {
        setLoadingTemplate(false);
      }
    };

    loadTemplate();
  }, [sectionId]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      const fallbackNumericStudentId = Number(String(studentProfile.studentId || "").replace(/\D/g, "")) || 1;
      const payload = {
        section_id: sectionId,
        student_id: fallbackNumericStudentId,
        responses: {
          ...responses,
          ...(buddyRequestStudentId ? { buddy_id: Number(buddyRequestStudentId) } : {}),
        },
      };

      const response = await fetch(`${STUDENT_FORM_API_BASE}/submission`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody?.error?.message || "Failed to submit form");
      }

      alert("Form submitted successfully!");
      navigate("/student");
    } catch (error) {
      alert(`Unable to submit form: ${error.message}`);
    }
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
        {!loadingTemplate && templateFields.length > 0
          ? templateFields.map((field, index) => (
              <ModuleBlock
                key={field.key}
                componentId={`MOD-R${index + 1}`}
                eyebrow={`Criterion ${String(index + 1).padStart(2, "0")}`}
                title={field.label}
              >
                {field.input_type === "select" ? (
                  <select
                    value={responses[field.key] ?? ""}
                    onChange={(event) =>
                      setResponses((currentResponses) => ({
                        ...currentResponses,
                        [field.key]: event.target.value,
                      }))
                    }
                    className={styles.select}
                    required={field.required}
                  >
                    <option value="">Select an option</option>
                    {(field.options || []).map((optionValue) => (
                      <option key={optionValue} value={optionValue}>
                        {optionValue}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.input_type === "number" ? "number" : "text"}
                    value={responses[field.key] ?? ""}
                    onChange={(event) =>
                      setResponses((currentResponses) => ({
                        ...currentResponses,
                        [field.key]:
                          field.input_type === "number"
                            ? Number(event.target.value)
                            : event.target.value,
                      }))
                    }
                    className={styles.input}
                    required={field.required}
                  />
                )}
              </ModuleBlock>
            ))
          : selectedForm.criteria.map((criterion, index) => (
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
