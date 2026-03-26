import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import {
  AlertTriangle,
  ArrowLeft,
  Plus,
  Save,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Wrench,
  Trash2,
} from "lucide-react";
import ModuleBlock from "../../../components/schematic/ModuleBlock";
import SystemTag from "../../../components/schematic/SystemTag";
import { Button } from "../../../components/ui/button";
import chrome from "../../../styles/instructorChrome.module.css";
import {
  getBackendCourseId,
  getBackendSectionId,
} from "../../../data/backendIds";
import { mockCourses, mockForms } from "../../../data/mockData";
import {
  fetchFormationConfig,
  saveFormationConfig,
} from "../../../services/formationConfigService";
import styles from "./CreateForm.module.css";
import { WEIGHT_FIELDS, DEFAULT_WEIGHTS } from "./logic/weights";
import { buildDefaultState } from "./logic/buildDefaultState";
import { normalizeLoadedConfig } from "./logic/normalizeLoadedConfig";

function CreateForm() {
  const { courseId, groupId } = useParams();
  const selectedCourse = mockCourses.find((course) => course.id === courseId);
  const selectedGroup = selectedCourse?.groups.find(
    (group) => group.id === groupId,
  );
  const existingForm = mockForms[groupId || ""];
  const backendCourseId = getBackendCourseId(courseId || "");
  const backendSectionId = getBackendSectionId(groupId || "");
  const defaultState = useMemo(
    () => buildDefaultState(selectedGroup, existingForm),
    [selectedGroup, existingForm],
  );

  const [formState, setFormState] = useState(defaultState);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadSource, setLoadSource] = useState("mock");
  const [errorMessage, setErrorMessage] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [isPublishingLinks, setIsPublishingLinks] = useState(false);
  const [activePanel, setActivePanel] = useState("parameters");

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
        setErrorMessage(
          "Missing backend UUID mapping for this course group. Update frontend/src/data/backendIds.js before connecting this group.",
        );
        return;
      }

      try {
        const response = await fetchFormationConfig(backendSectionId);
        if (!isMounted) {
          return;
        }

        const normalized = normalizeLoadedConfig(
          response,
          selectedGroup,
          defaultState,
        );
        setFormState(normalized);
        setLoadSource(response?.criteria ? "backend" : "mock");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setFormState(defaultState);
        setLoadSource("mock");
        setErrorMessage(
          `Backend load failed. Showing fallback values instead. ${error.message}`,
        );
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
  }, [
    backendCourseId,
    backendSectionId,
    defaultState,
    selectedCourse,
    selectedGroup,
  ]);

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
      topics: [
        ...current.topics,
        { id: `topic-${Date.now()}`, topic_label: "" },
      ],
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
      skills: [
        ...current.skills,
        { id: `skill-${Date.now()}`, skill_label: "", skill_importance: 0.25 },
      ],
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
    const derivedNumGroups = Math.max(
      1,
      Math.ceil(selectedGroup.studentsCount / preferredGroupSize),
    );

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
      setErrorMessage(
        "Missing backend UUID mapping for this course group. Update frontend/src/data/backendIds.js before saving.",
      );
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
        year_weight: formState.mixYear
          ? Number(formState.weights.year_weight)
          : 0,
        gender_weight: formState.mixGender
          ? Number(formState.weights.gender_weight)
          : 0,
        gpa_weight: Number(formState.weights.gpa_weight),
        reputation_weight: Number(formState.weights.reputation_weight),
        mbti_weight: Number(formState.weights.mbti_weight),
        buddy_weight: formState.allowBuddy
          ? Number(formState.weights.buddy_weight)
          : 0,
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
      setSaveMessage(
        mode === "publish"
          ? "Group form published to formation-config."
          : "Group form draft saved to formation-config.",
      );
      return true;
    } catch (error) {
      setErrorMessage(`Save failed. ${error.message}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const backendStatusTone =
    loadSource === "backend" ? "success" : errorMessage ? "alert" : "neutral";
  const activeWeights = WEIGHT_FIELDS.reduce(
    (sum, field) => sum + Number(formState.weights[field.key] || 0),
    0,
  );

  const handlePublish = async () => {
    if (!backendCourseId || !backendSectionId) {
      setErrorMessage(
        "Missing backend UUID mapping for this course group. Update frontend/src/data/backendIds.js before publishing.",
      );
      return;
    }

    setIsPublishingLinks(true);
    setErrorMessage("");
    setSaveMessage("");
    try {
      const saved = await handleSave("publish");
      if (!saved) {
        throw new Error(
          "Unable to save formation-config before notification dispatch.",
        );
      }

      const payload = {
        section_id: backendSectionId,
        criteria: {
          course_id: backendCourseId,
          section_id: backendSectionId,
          num_groups: Number(formState.numGroups),
          school_weight: Number(formState.weights.school_weight),
          year_weight: formState.mixYear
            ? Number(formState.weights.year_weight)
            : 0,
          gender_weight: formState.mixGender
            ? Number(formState.weights.gender_weight)
            : 0,
          gpa_weight: Number(formState.weights.gpa_weight),
          reputation_weight: Number(formState.weights.reputation_weight),
          mbti_weight: Number(formState.weights.mbti_weight),
          buddy_weight: formState.allowBuddy
            ? Number(formState.weights.buddy_weight)
            : 0,
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

      const response = await fetch(
        `${FORMATION_NOTIFICATION_API_BASE}/send-form-links`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(
          errorBody?.message ||
            "Failed to generate and send student form links",
        );
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

  const sectionItems = [
    {
      id: "parameters",
      label: "Group parameters",
      meta: `${formState.numGroups} teams planned`,
      eyebrow: "Ruleset",
      title: "Group setup parameters",
      description:
        "Set team size rules and the balancing toggles the solver should respect.",
      icon: <Settings2 className={styles.sectionIcon} />,
      metric: formState.numGroups,
      metricLabel: "Teams to generate",
      content: (
        <div className={styles.fieldGrid}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Preferred team size</span>
            <input
              type="number"
              min="2"
              value={formState.preferredGroupSize}
              onChange={(event) =>
                handlePreferredGroupSizeChange(event.target.value)
              }
              className={styles.input}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Number of teams</span>
            <input
              type="number"
              min="1"
              value={formState.numGroups}
              onChange={(event) =>
                setStateValue(
                  "numGroups",
                  Math.max(1, Number(event.target.value) || 1),
                )
              }
              className={styles.input}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Minimum team size</span>
            <input
              type="number"
              min="2"
              value={formState.minimumGroupSize}
              onChange={(event) =>
                setStateValue(
                  "minimumGroupSize",
                  Math.max(2, Number(event.target.value) || 2),
                )
              }
              className={styles.input}
            />
          </label>
          <div className={styles.toggleGrid}>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={formState.mixGender}
                onChange={(event) =>
                  setStateValue("mixGender", event.target.checked)
                }
              />{" "}
              <span>Balance gender</span>
            </label>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={formState.mixYear}
                onChange={(event) =>
                  setStateValue("mixYear", event.target.checked)
                }
              />{" "}
              <span>Balance year of study</span>
            </label>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={formState.allowBuddy}
                onChange={(event) =>
                  setStateValue("allowBuddy", event.target.checked)
                }
              />{" "}
              <span>Allow buddy requests</span>
            </label>
          </div>
        </div>
      ),
    },
    {
      id: "priorities",
      label: "Formation priorities",
      meta: `${activeWeights.toFixed(2)} total signal`,
      eyebrow: "Weighting",
      title: "Formation priorities",
      description:
        "Tune how much influence each signal should have during team generation.",
      icon: <SlidersHorizontal className={styles.sectionIcon} />,
      metric: activeWeights.toFixed(2),
      metricLabel: "Total weighting signal",
      content: (
        <div className={styles.criteriaList}>
          {WEIGHT_FIELDS.map((field) => (
            <div key={field.key} className={styles.criterionCard}>
              <div className={styles.criterionHeader}>
                <div>
                  <p className={styles.criterionCode}>{field.label}</p>
                  <p className={styles.helperText}>{field.helper}</p>
                </div>
                <SystemTag tone="neutral">
                  {Number(formState.weights[field.key]).toFixed(2)}
                </SystemTag>
              </div>
              <input
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={formState.weights[field.key]}
                onChange={(event) =>
                  setWeightValue(field.key, event.target.value)
                }
                className={styles.input}
              />
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "topics",
      label: "Project topics",
      meta: `${formState.topics.length} topics saved`,
      eyebrow: "Topics",
      title: "Project topics",
      description:
        "Maintain the topic pool students can align around during formation.",
      icon: <Sparkles className={styles.sectionIcon} />,
      metric: formState.topics.length,
      metricLabel: "Topics saved",
      actions: (
        <Button onClick={addTopic} variant="default" size="sm">
          <Plus className={styles.buttonIcon} /> Add topic
        </Button>
      ),
      content: (
        <div className={styles.criteriaList}>
          {formState.topics.length ? (
            formState.topics.map((topic, index) => (
              <div key={topic.id} className={styles.criterionCard}>
                <div className={styles.criterionHeader}>
                  <p className={styles.criterionCode}>
                    Topic {String(index + 1).padStart(2, "0")}
                  </p>
                  <Button
                    onClick={() => removeTopic(topic.id)}
                    variant="warning"
                    size="icon"
                  >
                    <Trash2 className={styles.buttonIcon} />
                  </Button>
                </div>
                <input
                  type="text"
                  value={topic.topic_label}
                  onChange={(event) =>
                    updateTopic(topic.id, event.target.value)
                  }
                  placeholder="Example: AI product design"
                  className={styles.input}
                />
              </div>
            ))
          ) : (
            <p className={styles.emptyState}>No topics added yet.</p>
          )}
        </div>
      ),
    },
    {
      id: "skills",
      label: "Tracked skills",
      meta: `${formState.skills.length} skills tracked`,
      eyebrow: "Skills",
      title: "Tracked skills",
      description:
        "Define the capabilities you want the formation process to distribute across teams.",
      icon: <Wrench className={styles.sectionIcon} />,
      metric: formState.skills.length,
      metricLabel: "Skills tracked",
      actions: (
        <Button onClick={addSkill} variant="default" size="sm">
          <Plus className={styles.buttonIcon} /> Add skill
        </Button>
      ),
      content: (
        <div className={styles.criteriaList}>
          {formState.skills.length ? (
            formState.skills.map((skill, index) => (
              <div key={skill.id} className={styles.criterionCard}>
                <div className={styles.criterionHeader}>
                  <p className={styles.criterionCode}>
                    Skill {String(index + 1).padStart(2, "0")}
                  </p>
                  <Button
                    onClick={() => removeSkill(skill.id)}
                    variant="warning"
                    size="icon"
                  >
                    <Trash2 className={styles.buttonIcon} />
                  </Button>
                </div>
                <input
                  type="text"
                  value={skill.skill_label}
                  onChange={(event) =>
                    updateSkill(skill.id, { skill_label: event.target.value })
                  }
                  placeholder="Example: React"
                  className={styles.input}
                />
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Skill importance</span>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    value={skill.skill_importance}
                    onChange={(event) =>
                      updateSkill(skill.id, {
                        skill_importance: Number(event.target.value),
                      })
                    }
                    className={styles.input}
                  />
                </label>
              </div>
            ))
          ) : (
            <p className={styles.emptyState}>No skills added yet.</p>
          )}
        </div>
      ),
    },
  ];

  const activeSection =
    sectionItems.find((section) => section.id === activePanel) ||
    sectionItems[0];

  return (
    <div className={styles.page}>
      <Link to="/instructor/courses" className={chrome.backLink}>
        <ArrowLeft className={chrome.backIcon} /> Return to course matrix
      </Link>

      <section className={chrome.hero}>
        <div>
          <p className={chrome.kicker}>[GROUP FORM]</p>
          <h2 className={chrome.title}>
            {selectedGroup.code} - {selectedCourse.name}
          </h2>
          <p className={chrome.subtitle}>
            Configure the solver inputs for this group using the sidebar
            workspace.
          </p>
        </div>
        <SystemTag tone={backendStatusTone}>
          {loadSource === "backend"
            ? "Backend config loaded"
            : "Fallback values loaded"}
        </SystemTag>
      </section>

      <div className={styles.statusPanel}>
        <div>
          <p className={styles.statusLabel}>Integration mapping</p>
          <p className={styles.statusText}>
            Frontend group ID <strong>{selectedGroup.id}</strong> maps to
            backend section_id <strong>{backendSectionId ?? "missing"}</strong>.
          </p>
        </div>
        <p className={styles.summaryMeta}>
          {selectedGroup.studentsCount} students | {selectedGroup.teamsCount}{" "}
          existing teams
        </p>
      </div>

      {errorMessage ? (
        <div className={styles.feedbackAlert}>
          <AlertTriangle className={styles.feedbackIcon} />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      {saveMessage ? (
        <div className={styles.feedbackSuccess}>{saveMessage}</div>
      ) : null}

      <div className={styles.workspace}>
        <ModuleBlock
          componentId="MOD-FNAV"
          eyebrow="Sections"
          title="Form builder"
          className={styles.sideModule}
        >
          <div className={styles.sectionList}>
            {sectionItems.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setActivePanel(section.id)}
                className={`${styles.sectionButton} ${activeSection.id === section.id ? styles.sectionButtonActive : ""}`}
              >
                <div className={styles.sectionButtonHeader}>
                  {section.icon}
                  <span className={styles.sectionTitle}>{section.label}</span>
                </div>
                <span className={styles.sectionMeta}>{section.meta}</span>
              </button>
            ))}
          </div>
        </ModuleBlock>

        <div className={styles.mainColumn}>
          <ModuleBlock
            componentId="MOD-FWORK"
            eyebrow={activeSection.eyebrow}
            title={activeSection.title}
            metric={activeSection.metric}
            metricLabel={activeSection.metricLabel}
            className={styles.detailModule}
            actions={activeSection.actions}
          >
            <div className={styles.detailHeader}>
              <p className={styles.helperText}>{activeSection.description}</p>
            </div>
            {activeSection.content}
          </ModuleBlock>

          <div className={styles.actionRow}>
            <Button
              variant="default"
              onClick={() => handleSave("draft")}
              disabled={isSaving || isLoading}
            >
              {isSaving ? <Save className={styles.buttonIcon} /> : null} Save
              draft
            </Button>
            <Button
              variant="success"
              onClick={handlePublish}
              disabled={isSaving || isLoading || isPublishingLinks}
            >
              {isPublishingLinks ? "Publishing..." : "Publish form"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CreateForm;
