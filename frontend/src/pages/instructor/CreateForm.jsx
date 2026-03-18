import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import ModuleBlock from "../../components/schematic/ModuleBlock";
import SystemTag from "../../components/schematic/SystemTag";
import { mockCourses, mockForms } from "../../data/mockData";
import styles from "./CreateForm.module.css";

function CreateForm() {
  const { courseId, groupId } = useParams();
  const selectedCourse = mockCourses.find((course) => course.id === courseId);
  const selectedGroup = selectedCourse?.groups.find((group) => group.id === groupId);
  const existingForm = mockForms[groupId || ""];

  const initialCriteria = useMemo(
    () =>
      existingForm?.criteria?.map((criterion) => ({
        id: criterion.id,
        question: criterion.question,
        weight: criterion.weight,
      })) || [
        { id: "c1", question: "Technical skill in backend development", weight: 0.3 },
        { id: "c2", question: "Communication and teamwork", weight: 0.2 },
      ],
    [existingForm],
  );

  const [groupSize, setGroupSize] = useState(existingForm?.groupSize ?? 5);
  const [minimumGroupSize, setMinimumGroupSize] = useState(existingForm?.minimumGroupSize ?? 4);
  const [mixGender, setMixGender] = useState(existingForm?.mixGender ?? true);
  const [mixYear, setMixYear] = useState(existingForm?.mixYear ?? true);
  const [allowBuddy, setAllowBuddy] = useState(existingForm?.allowBuddy ?? true);
  const [criteria, setCriteria] = useState(initialCriteria);

  if (!selectedCourse || !selectedGroup) {
    return <div className={styles.notFound}>Course group not found</div>;
  }

  const addCriterion = () => {
    setCriteria((currentCriteria) => [
      ...currentCriteria,
      { id: `criterion-${Date.now()}`, question: "", weight: 0.1 },
    ]);
  };

  const updateCriterion = (criterionId, updates) => {
    setCriteria((currentCriteria) =>
      currentCriteria.map((criterion) =>
        criterion.id === criterionId ? { ...criterion, ...updates } : criterion,
      ),
    );
  };

  const removeCriterion = (criterionId) => {
    setCriteria((currentCriteria) =>
      currentCriteria.filter((criterion) => criterion.id !== criterionId),
    );
  };

  const totalWeight = criteria.reduce((sum, criterion) => sum + Number(criterion.weight || 0), 0);

  return (
    <div className={styles.page}>
      <Link to="/instructor/courses" className={styles.backLink}>
        <ArrowLeft className={styles.backIcon} /> Return to course matrix
      </Link>

      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>[GROUP FORM BUILDER]</p>
          <h2 className={styles.title}>{existingForm ? 'Edit' : 'Create'} formation logic for {selectedGroup.code}</h2>
          <p className={styles.subtitle}>{selectedCourse.name} :: each teaching group must carry its own separate rule set and survey.</p>
        </div>
        <SystemTag tone={existingForm ? 'success' : 'neutral'}>{existingForm ? 'Existing group form loaded' : 'Draft rule set'}</SystemTag>
      </section>

      <div className={styles.grid}>
        <ModuleBlock componentId="MOD-F01" eyebrow="Ruleset" title="Group Setup Parameters" metric={groupSize} metricLabel="Preferred team size">
          <div className={styles.fieldGrid}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Preferred group size</span>
              <input type="number" min="2" value={groupSize} onChange={(event) => setGroupSize(Number(event.target.value))} className={styles.input} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Minimum group size</span>
              <input type="number" min="2" value={minimumGroupSize} onChange={(event) => setMinimumGroupSize(Number(event.target.value))} className={styles.input} />
            </label>
          </div>
          <div className={styles.toggleGrid}>
            <label className={styles.toggle}><input type="checkbox" checked={mixGender} onChange={(event) => setMixGender(event.target.checked)} /> <span>Mix gender</span></label>
            <label className={styles.toggle}><input type="checkbox" checked={mixYear} onChange={(event) => setMixYear(event.target.checked)} /> <span>Mix year</span></label>
            <label className={styles.toggle}><input type="checkbox" checked={allowBuddy} onChange={(event) => setAllowBuddy(event.target.checked)} /> <span>Allow buddy requests</span></label>
          </div>
        </ModuleBlock>

        <ModuleBlock componentId="MOD-F02" eyebrow="Weighting" title="Criteria Registry" metric={totalWeight.toFixed(2)} metricLabel="Current total weight" actions={<button onClick={addCriterion} className={styles.primaryButton}><Plus className={styles.buttonIcon} /> Add criterion</button>}>
          <div className={styles.criteriaList}>
            {criteria.map((criterion, index) => (
              <div key={criterion.id} className={styles.criterionCard}>
                <div className={styles.criterionHeader}>
                  <p className={styles.criterionCode}>Criterion {String(index + 1).padStart(2, '0')}</p>
                  <button onClick={() => removeCriterion(criterion.id)} className={styles.iconButton}><Trash2 className={styles.buttonIcon} /></button>
                </div>
                <input type="text" value={criterion.question} onChange={(event) => updateCriterion(criterion.id, { question: event.target.value })} placeholder="Example: Confidence in backend development" className={styles.input} />
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Weight</span>
                  <input type="number" min="0" max="1" step="0.05" value={criterion.weight} onChange={(event) => updateCriterion(criterion.id, { weight: Number(event.target.value) })} className={styles.input} />
                </label>
              </div>
            ))}
          </div>
        </ModuleBlock>
      </div>

      <div className={styles.actionRow}>
        <button className={styles.primaryButton}>Save draft</button>
        <button className={styles.successButton}>Publish form</button>
      </div>
    </div>
  );
}

export default CreateForm;
