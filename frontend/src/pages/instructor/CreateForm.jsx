import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { AlertTriangle, ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import ModuleBlock from "../../components/schematic/ModuleBlock";
import SystemTag from "../../components/schematic/SystemTag";
import { getBackendCourseId, getBackendSectionId } from "../../data/backendIds";
import { mockCourses, mockForms } from "../../data/mockData";
import { fetchFormationConfig, saveFormationConfig } from "../../services/formationConfigService";
import styles from "./CreateForm.module.css";

const FORMATION_NOTIFICATION_API_BASE =
  import.meta.env.VITE_FORMATION_NOTIFICATION_API_BASE ||
  "http://localhost:4004/formation-notification";

const WEIGHT_FIELDS = [
  { key: "skill_weight", label: "Skill balance", helper: "How strongly to balance technical skills across teams." },
  { key: "topic_weight", label: "Topic preference", helper: "How strongly topic interest should shape teams." },
  { key: "buddy_weight", label: "Buddy requests", helper: "How strongly to respect preferred teammate requests." },
  { key: "year_weight", label: "Year mix", helper: "How strongly to mix students from different years." },
  { key: "gender_weight", label: "Gender mix", helper: "How strongly to balance gender across teams." },
  { key: "gpa_weight", label: "GPA balance", helper: "How strongly to balance academic performance." },
  { key: "reputation_weight", label: "Reputation", helper: "How strongly to spread high-reputation students." },
  { key: "school_weight", label: "School mix", helper: "How strongly to mix students across schools." },
  { key: "mbti_weight", label: "MBTI mix", helper: "How strongly to account for personality data." },
  { key: "randomness", label: "Randomness", helper: "How much variety to allow beyond strict optimization." },
];

const DEFAULT_WEIGHTS = {
  school_weight: 0.15,
  year_weight: 0.8,
  gender_weight: 0.8,
  gpa_weight: 0.4,
  reputation_weight: 0.3,
  mbti_weight: 0.2,
  buddy_weight: 0.8,
  topic_weight: 0.65,
  skill_weight: 1,
  randomness: 0.1,
};

function buildDefaultState(group, existingForm) {
  const preferredGroupSize = existingForm?.groupSize ?? 5;
  const numGroups = Math.max(1, Math.ceil((group?.studentsCount ?? preferredGroupSize) / preferredGroupSize));
  const minimumGroupSize = existingForm?.minimumGroupSize ?? Math.max(2, preferredGroupSize - 1);

  return {
    numGroups,
    preferredGroupSize,
    minimumGroupSize,
    mixGender: existingForm?.mixGender ?? true,
    mixYear: existingForm?.mixYear ?? true,
    allowBuddy: existingForm?.allowBuddy ?? true,
    weights: {
      ...DEFAULT_WEIGHTS,
      gender_weight: existingForm?.mixGender === false ? 0 : DEFAULT_WEIGHTS.gender_weight,
      year_weight: existingForm?.mixYear === false ? 0 : DEFAULT_WEIGHTS.year_weight,
      buddy_weight: existingForm?.allowBuddy === false ? 0 : DEFAULT_WEIGHTS.buddy_weight,
    },
    topics:
      existingForm?.criteria
        ?.filter((criterion) => criterion.type === "multiple-choice" && criterion.options?.length)
        .flatMap((criterion) => criterion.options ?? [])
        .slice(0, 4) ?? [],
    skills:
      existingForm?.criteria?.length
        ? existingForm.criteria.slice(0, 3).map((criterion, index) => ({
            id: `skill-${criterion.id}-${index}`,
            skill_label: criterion.question,
            skill_importance: Number((criterion.weight ?? 0.3).toFixed(2)),
          }))
        : [
            { id: "skill-1", skill_label: "Backend development", skill_importance: 0.5 },
            { id: "skill-2", skill_label: "Communication", skill_importance: 0.35 },
          ],
  };
}

function normalizeLoadedConfig(config, group, fallbackState) {
  const criteria = config?.criteria;
  if (!criteria) {
    return fallbackState;
  }

  const numGroups = Number(criteria.num_groups) || fallbackState.numGroups;
  const preferredGroupSize = Math.max(2, Math.ceil((group?.studentsCount ?? numGroups) / numGroups));

  return {
    numGroups,
    preferredGroupSize,
    minimumGroupSize: fallbackState.minimumGroupSize,
    mixGender: Number(criteria.gender_weight ?? 0) > 0,
    mixYear: Number(criteria.year_weight ?? 0) > 0,
    allowBuddy: Number(criteria.buddy_weight ?? 0) > 0,
    weights: {
      ...DEFAULT_WEIGHTS,
      school_weight: Number(criteria.school_weight ?? DEFAULT_WEIGHTS.school_weight),
      year_weight: Number(criteria.year_weight ?? DEFAULT_WEIGHTS.year_weight),
      gender_weight: Number(criteria.gender_weight ?? DEFAULT_WEIGHTS.gender_weight),
      gpa_weight: Number(criteria.gpa_weight ?? DEFAULT_WEIGHTS.gpa_weight),
      reputation_weight: Number(criteria.reputation_weight ?? DEFAULT_WEIGHTS.reputation_weight),
      mbti_weight: Number(criteria.mbti_weight ?? DEFAULT_WEIGHTS.mbti_weight),
      buddy_weight: Number(criteria.buddy_weight ?? DEFAULT_WEIGHTS.buddy_weight),
      topic_weight: Number(criteria.topic_weight ?? DEFAULT_WEIGHTS.topic_weight),
      skill_weight: Number(criteria.skill_weight ?? DEFAULT_WEIGHTS.skill_weight),
      randomness: Number(criteria.randomness ?? DEFAULT_WEIGHTS.randomness),
    },
    topics: (config.topics ?? []).map((topic, index) => ({ id: `topic-${index + 1}`, topic_label: topic.topic_label ?? "" })),
    skills: (config.skills ?? []).map((skill, index) => ({
      id: `skill-${index + 1}`,
      skill_label: skill.skill_label ?? "",
      skill_importance: Number(skill.skill_importance ?? 0),
    })),
  };
}

function CreateForm() {
  const { courseId, groupId } = useParams();
  const selectedCourse = mockCourses.find((course) => course.id === courseId);
  const selectedGroup = selectedCourse?.groups.find((group) => group.id === groupId);
  const existingForm = mockForms[groupId || ""];
  const backendCourseId = getBackendCourseId(courseId || "");
  const backendSectionId = getBackendSectionId(groupId || "");
  const defaultState = useMemo(() => buildDefaultState(selectedGroup, existingForm), [selectedGroup, existingForm]);

  const [formState, setFormState] = useState(defaultState);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadSource, setLoadSource] = useState("mock");
  const [errorMessage, setErrorMessage] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [isPublishingLinks, setIsPublishingLinks] = useState(false);

  useEffect(() => {
    setFormState(defaultState);
  }, [defaultState]);

  useEffect(() => {
    let isMounted = true;

    async function loadConfig() {
      if (!selectedCourse || !selectedGroup) {
        return;
      }

      setIsLoading(true);
      setErrorMessage("");
      setSaveMessage("");

      if (!backendCourseId || !backendSectionId) {
        setLoadSource("mock");
        setIsLoading(false);
        setErrorMessage("Missing backend UUID mapping for this course group. Update frontend/src/data/backendIds.js before connecting this group.");
        return;
      }

      try {
        const response = await fetchFormationConfig(backendSectionId);
        if (!isMounted) {
          return;
        }

        const normalized = normalizeLoadedConfig(response, selectedGroup, defaultState);
        setFormState(normalized);
        setLoadSource(response?.criteria ? "backend" : "mock");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setFormState(defaultState);
        setLoadSource("mock");
        setErrorMessage(`Backend load failed. Showing fallback values instead. ${error.message}`);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadConfig();

    return () => {
      isMounted = false;
    };
  }, [backendCourseId, backendSectionId, defaultState, selectedCourse, selectedGroup]);

  if (!selectedCourse || !selectedGroup) {
    return <div className={styles.notFound}>Course group not found</div>;
  }

  const setStateValue = (field, value) => {
    setFormState((current) => ({ ...current, [field]: value }));
  };

  const setWeightValue = (weightKey, value) => {
    setFormState((current) => ({
      ...current,
      weights: {
        ...current.weights,
        [weightKey]: Number(value),
      },
    }));
  };

  const addTopic = () => {
    setFormState((current) => ({
      ...current,
      topics: [...current.topics, { id: `topic-${Date.now()}`, topic_label: "" }],
    }));
  };

  const updateTopic = (topicId, topicLabel) => {
    setFormState((current) => ({
      ...current,
      topics: current.topics.map((topic) =>
        topic.id === topicId ? { ...topic, topic_label: topicLabel } : topic,
      ),
    }));
  };

  const removeTopic = (topicId) => {
    setFormState((current) => ({
      ...current,
      topics: current.topics.filter((topic) => topic.id !== topicId),
    }));
  };

  const addSkill = () => {
    setFormState((current) => ({
      ...current,
      skills: [...current.skills, { id: `skill-${Date.now()}`, skill_label: "", skill_importance: 0.25 }],
    }));
  };

  const updateSkill = (skillId, updates) => {
    setFormState((current) => ({
      ...current,
      skills: current.skills.map((skill) =>
        skill.id === skillId ? { ...skill, ...updates } : skill,
      ),
    }));
  };

  const removeSkill = (skillId) => {
    setFormState((current) => ({
      ...current,
      skills: current.skills.filter((skill) => skill.id !== skillId),
    }));
  };

  const handlePreferredGroupSizeChange = (value) => {
    const preferredGroupSize = Math.max(2, Number(value) || 2);
    const derivedNumGroups = Math.max(1, Math.ceil(selectedGroup.studentsCount / preferredGroupSize));

    setFormState((current) => ({
      ...current,
      preferredGroupSize,
      numGroups: derivedNumGroups,
      minimumGroupSize: Math.min(current.minimumGroupSize, preferredGroupSize),
    }));
  };

  const handleSave = async (mode) => {
    setIsSaving(true);
    setSaveMessage("");
    setErrorMessage("");

    if (!backendCourseId || !backendSectionId) {
      setErrorMessage("Missing backend UUID mapping for this course group. Update frontend/src/data/backendIds.js before saving.");
      setIsSaving(false);
      return false;
    }

    const payload = {
      courseId: backendCourseId,
      sectionId: backendSectionId,
      criteria: {
        course_id: backendCourseId,
        section_id: backendSectionId,
        num_groups: Number(formState.numGroups),
        school_weight: Number(formState.weights.school_weight),
        year_weight: formState.mixYear ? Number(formState.weights.year_weight) : 0,
        gender_weight: formState.mixGender ? Number(formState.weights.gender_weight) : 0,
        gpa_weight: Number(formState.weights.gpa_weight),
        reputation_weight: Number(formState.weights.reputation_weight),
        mbti_weight: Number(formState.weights.mbti_weight),
        buddy_weight: formState.allowBuddy ? Number(formState.weights.buddy_weight) : 0,
        topic_weight: Number(formState.weights.topic_weight),
        skill_weight: Number(formState.weights.skill_weight),
        randomness: Number(formState.weights.randomness),
      },
      topics: formState.topics
        .map((topic) => topic.topic_label.trim())
        .filter(Boolean)
        .map((topic_label) => ({ topic_label })),
      skills: formState.skills
        .map((skill) => ({
          skill_label: skill.skill_label.trim(),
          skill_importance: Number(skill.skill_importance),
        }))
        .filter((skill) => skill.skill_label),
    };

    try {
      await saveFormationConfig(payload);
      setLoadSource("backend");
      setSaveMessage(mode === "publish" ? "Group form published to formation-config." : "Group form draft saved to formation-config.");
      return true;
    } catch (error) {
      setErrorMessage(`Save failed. ${error.message}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const backendStatusTone = loadSource === "backend" ? "success" : errorMessage ? "alert" : "neutral";
  const activeWeights = WEIGHT_FIELDS.reduce((sum, field) => sum + Number(formState.weights[field.key] || 0), 0);

  const handlePublish = async () => {
    if (!backendCourseId || !backendSectionId) {
      setErrorMessage("Missing backend UUID mapping for this course group. Update frontend/src/data/backendIds.js before publishing.");
      return;
    }

    setIsPublishingLinks(true);
    setErrorMessage("");
    setSaveMessage("");
    try {
      const saved = await handleSave("publish");
      if (!saved) {
        throw new Error("Unable to save formation-config before notification dispatch.");
      }

      const payload = {
        section_id: backendSectionId,
        criteria: {
          course_id: backendCourseId,
          section_id: backendSectionId,
          num_groups: Number(formState.numGroups),
          school_weight: Number(formState.weights.school_weight),
          year_weight: formState.mixYear ? Number(formState.weights.year_weight) : 0,
          gender_weight: formState.mixGender ? Number(formState.weights.gender_weight) : 0,
          gpa_weight: Number(formState.weights.gpa_weight),
          reputation_weight: Number(formState.weights.reputation_weight),
          mbti_weight: Number(formState.weights.mbti_weight),
          buddy_weight: formState.allowBuddy ? Number(formState.weights.buddy_weight) : 0,
          topic_weight: Number(formState.weights.topic_weight),
          skill_weight: Number(formState.weights.skill_weight),
          randomness: Number(formState.weights.randomness),
        },
        custom_entries: formState.skills
          .filter((skill) => skill.skill_label.trim())
          .map((skill, index) => ({
            key: `skill_${index + 1}`,
            label: skill.skill_label.trim(),
            input_type: "number",
            required: true,
            weight: Number(skill.skill_importance || 0),
          })),
        base_form_url: `${window.location.origin}/student/fill-form`,
      };

      const response = await fetch(`${FORMATION_NOTIFICATION_API_BASE}/send-form-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody?.message || "Failed to generate and send student form links");
      }

      const result = await response.json();
      const data = result?.data || {};
      setSaveMessage(
        `Published. Generated ${data.generated_links_count ?? 0} link(s); notification success: ${data.success_count ?? 0}, failure: ${data.failure_count ?? 0}.`,
      );
    } catch (error) {
      setErrorMessage(`Publish failed. ${error.message}`);
    } finally {
      setIsPublishingLinks(false);
    }
  };

  return (
    <div className={styles.page}>
      <Link to="/instructor/courses" className={styles.backLink}>
        <ArrowLeft className={styles.backIcon} /> Return to course matrix
      </Link>

      <section className={styles.hero}>
        <div>
          <h2 className={styles.title}>{existingForm ? "Edit" : "Create"} formation logic for {selectedGroup.code}</h2>
          <p className={styles.subtitle}>This screen now saves the group configuration to the backend formation-config service using {selectedGroup.code} as the section scope.</p>
        </div>
        <SystemTag tone={backendStatusTone}>{loadSource === "backend" ? "Backend config loaded" : "Fallback values loaded"}</SystemTag>
      </section>

      <div className={styles.statusPanel}>
        <div>
          <p className={styles.statusLabel}>Integration mapping</p>
          <p className={styles.statusText}>Frontend group ID <strong>{selectedGroup.id}</strong> maps to backend section_id <strong>{backendSectionId ?? "missing"}</strong>.</p>
        </div>
        {isLoading ? <SystemTag tone="neutral">Loading backend config</SystemTag> : null}
      </div>

      {errorMessage ? (
        <div className={styles.feedbackAlert}>
          <AlertTriangle className={styles.feedbackIcon} />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      {saveMessage ? <div className={styles.feedbackSuccess}>{saveMessage}</div> : null}

      <div className={styles.grid}>
        <ModuleBlock componentId="MOD-F01" eyebrow="Ruleset" title="Group setup parameters" metric={formState.numGroups} metricLabel="Teams to generate">
          <div className={styles.fieldGrid}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Preferred team size</span>
              <input type="number" min="2" value={formState.preferredGroupSize} onChange={(event) => handlePreferredGroupSizeChange(event.target.value)} className={styles.input} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Number of teams</span>
              <input type="number" min="1" value={formState.numGroups} onChange={(event) => setStateValue("numGroups", Math.max(1, Number(event.target.value) || 1))} className={styles.input} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Minimum team size</span>
              <input type="number" min="2" value={formState.minimumGroupSize} onChange={(event) => setStateValue("minimumGroupSize", Math.max(2, Number(event.target.value) || 2))} className={styles.input} />
            </label>
          </div>
          <div className={styles.toggleGrid}>
            <label className={styles.toggle}><input type="checkbox" checked={formState.mixGender} onChange={(event) => setStateValue("mixGender", event.target.checked)} /> <span>Balance gender</span></label>
            <label className={styles.toggle}><input type="checkbox" checked={formState.mixYear} onChange={(event) => setStateValue("mixYear", event.target.checked)} /> <span>Balance year of study</span></label>
            <label className={styles.toggle}><input type="checkbox" checked={formState.allowBuddy} onChange={(event) => setStateValue("allowBuddy", event.target.checked)} /> <span>Allow buddy requests</span></label>
          </div>
        </ModuleBlock>

        <ModuleBlock componentId="MOD-F02" eyebrow="Weighting" title="Formation priorities" metric={activeWeights.toFixed(2)} metricLabel="Total weighting signal">
          <div className={styles.criteriaList}>
            {WEIGHT_FIELDS.map((field) => (
              <div key={field.key} className={styles.criterionCard}>
                <div className={styles.criterionHeader}>
                  <div>
                    <p className={styles.criterionCode}>{field.label}</p>
                    <p className={styles.helperText}>{field.helper}</p>
                  </div>
                  <SystemTag tone="neutral">{Number(formState.weights[field.key]).toFixed(2)}</SystemTag>
                </div>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  value={formState.weights[field.key]}
                  onChange={(event) => setWeightValue(field.key, event.target.value)}
                  className={styles.input}
                />
              </div>
            ))}
          </div>
        </ModuleBlock>
      </div>

      <div className={styles.grid}>
        <ModuleBlock componentId="MOD-F03" eyebrow="Topics" title="Project topics" metric={formState.topics.length} metricLabel="Topics saved to backend" actions={<button onClick={addTopic} className={styles.primaryButton}><Plus className={styles.buttonIcon} /> Add topic</button>}>
          <div className={styles.criteriaList}>
            {formState.topics.length ? formState.topics.map((topic, index) => (
              <div key={topic.id} className={styles.criterionCard}>
                <div className={styles.criterionHeader}>
                  <p className={styles.criterionCode}>Topic {String(index + 1).padStart(2, "0")}</p>
                  <button onClick={() => removeTopic(topic.id)} className={styles.iconButton}><Trash2 className={styles.buttonIcon} /></button>
                </div>
                <input type="text" value={topic.topic_label} onChange={(event) => updateTopic(topic.id, event.target.value)} placeholder="Example: AI product design" className={styles.input} />
              </div>
            )) : <p className={styles.emptyState}>No topics added yet.</p>}
          </div>
        </ModuleBlock>

        <ModuleBlock componentId="MOD-F04" eyebrow="Skills" title="Tracked skills" metric={formState.skills.length} metricLabel="Skills saved to backend" actions={<button onClick={addSkill} className={styles.primaryButton}><Plus className={styles.buttonIcon} /> Add skill</button>}>
          <div className={styles.criteriaList}>
            {formState.skills.length ? formState.skills.map((skill, index) => (
              <div key={skill.id} className={styles.criterionCard}>
                <div className={styles.criterionHeader}>
                  <p className={styles.criterionCode}>Skill {String(index + 1).padStart(2, "0")}</p>
                  <button onClick={() => removeSkill(skill.id)} className={styles.iconButton}><Trash2 className={styles.buttonIcon} /></button>
                </div>
                <input type="text" value={skill.skill_label} onChange={(event) => updateSkill(skill.id, { skill_label: event.target.value })} placeholder="Example: React" className={styles.input} />
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Skill importance</span>
                  <input type="number" min="0" max="1" step="0.05" value={skill.skill_importance} onChange={(event) => updateSkill(skill.id, { skill_importance: Number(event.target.value) })} className={styles.input} />
                </label>
              </div>
            )) : <p className={styles.emptyState}>No skills added yet.</p>}
          </div>
        </ModuleBlock>
      </div>

      <div className={styles.actionRow}>
        <button  className={styles.primaryButton} onClick={() => handleSave("draft")} disabled={isSaving || isLoading}>
          {isSaving ? <Save className={styles.buttonIcon} /> : null} Save draft
        </button>
        <button className={styles.successButton} onClick={handlePublish} disabled={isSaving || isLoading || isPublishingLinks}>
          {isPublishingLinks ? "Publishing..." : "Publish form"}
        </button>
      </div>
    </div>
  );
}

export default CreateForm;
