import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import {
  AlertTriangle,
  ArrowLeft,
  CircleAlert,
  Plus,
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
  fetchFormationConfig,
  saveFormationConfig,
} from "../../../services/formationConfigService";
import styles from "./CreateForm.module.css";
import {
  WEIGHT_FIELDS,
  clampWeightValue,
  getNegativeWeightWarning,
  getWeightDescription,
  getWeightField,
  getWeightSliderBounds,
} from "./logic/weights";
import { buildDefaultState } from "./logic/buildDefaultState";
import { normalizeLoadedConfig } from "./logic/normalizeLoadedConfig";
import { buildSavePayload } from "./logic/payloads";
import { sendFormLinks } from "./service/notificationService";
import { fetchCourseByCode } from "../../../services/courseService";
import { getSectionById } from "../../../services/sectionService";
import { fetchEnrollmentCountBySectionId } from "../../../services/enrollmentService";
import { generateTeamsForSection } from "../../../services/teamFormationService";
import { isFormsRequired } from "../logic/formationFlow";
function CreateForm() {
  // takes course Id and Group ID from the params (already configured)
  const { courseId, groupId } = useParams();
  const location = useLocation();
  const isReadOnly = new URLSearchParams(location.search).get("mode") === "view";

  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [bootstrapError, setBootstrapError] = useState("");

  const defaultState = useMemo(
    () => buildDefaultState(selectedGroup),
    [selectedGroup],
  );
  const [formState, setFormState] = useState(defaultState);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingConfig, setIsFetchingConfig] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [isPublishingLinks, setIsPublishingLinks] = useState(false);
  const [activePanel, setActivePanel] = useState("parameters");
  const [studentCount, setStudentCount] = useState(0);
  
  
  useEffect(() => {
    async function fetchStudentCount() {
      try {
        const res = await fetchEnrollmentCountBySectionId(groupId);
        setStudentCount(res);
      } catch (error) {
        setErrorMessage(`Failed to load enrollment count. ${error?.message || String(error)}`);
      }
    }

    fetchStudentCount();
  }, [groupId]);

  useEffect(() => {
    let isMounted = true;

    async function fetchCourse() {
      try {
        const course = await fetchCourseByCode(courseId);
        if (!isMounted) {
          return;
        }
        setSelectedCourse(course);
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setBootstrapError(`Course load failed. ${error?.message || String(error)}`);
      }
    }

    fetchCourse();

    return () => {
      isMounted = false;
    };
  }, [courseId]);

  useEffect(() => {
    let isMounted = true;

    async function fetchSection() {
      try {
        const section = await getSectionById(groupId);
        if (!isMounted) {
          return;
        }
        setSelectedGroup(section);
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setBootstrapError(`Section load failed. ${error?.message || String(error)}`);
      }
    }

    fetchSection();

    return () => {
      isMounted = false;
    };
  }, [groupId]);


  useEffect(() => {
    let isMounted = true;
    // loads config
    async function loadConfig() {
      if (!selectedCourse || !selectedGroup) {
        return;
      }
      setIsLoading(true);
      setIsFetchingConfig(true);
      setErrorMessage("");
      setSaveMessage("");
      if (!groupId) {
        setIsLoading(false);
        setIsFetchingConfig(false);
        setErrorMessage("Missing backend section id for this course group.");
        return;
      }

      try {
        const response = await fetchFormationConfig(groupId);

        if (!isMounted) {
          return;
        }

        const normalized = normalizeLoadedConfig(
          response,
          selectedGroup,
          defaultState,
        );
        setFormState(normalized);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setFormState(defaultState);
        const message = error?.message || String(error);
        if (String(message).includes("404")) {
          setSaveMessage("No existing formation criteria found yet. You can configure and save now.");
        } else {
          setErrorMessage(`Backend load failed. ${message}`);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setIsFetchingConfig(false);
        }
      }
    }

    loadConfig();

    return () => {
      isMounted = false;
    };
  }, [defaultState, selectedCourse, selectedGroup]);
  if (bootstrapError) {
    return <div className={styles.notFound}>{bootstrapError}</div>;
  }

  if (!selectedCourse || !selectedGroup) {
    return <div className={styles.notFound}>Loading course...</div>;
  }

  const setStateValue = (field, value) => {
    setFormState((current) => ({ ...current, [field]: value }));
  };

  const setWeightValue = (weightKey, value) => {
    const nextValue = clampWeightValue(weightKey, value);
    setFormState((current) => ({
      ...current,
      weights: {
        ...current.weights,
        [weightKey]: nextValue,
      },
    }));
  };

  const createClientId = (prefix) => {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return `${prefix}-${crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  };

  const addTopic = () => {
    setFormState((current) => ({
      ...current,
      topics: [
        ...current.topics,
        { id: createClientId("topic"), topic_label: "" },
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
        {
          id: createClientId("skill"),
          skill_label: "",
          skill_importance: 0.0,
        },
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

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage("");
    setErrorMessage("");
    const backendCourseId = selectedCourse?.id || selectedCourse?.course_id || null;
    const backendSectionId = selectedGroup?.id || selectedGroup?.section_id || null;

    if (!backendCourseId || !backendSectionId) {
      setErrorMessage("Cannot save because course/section backend identifiers are missing.");
      setIsSaving(false);
      return false;
    }

    const payload = buildSavePayload(
      formState,
      backendCourseId,
      backendSectionId,
    );
    try {
      await saveFormationConfig(payload);
      setSaveMessage("Formation criteria saved.");
      return true;

    } catch (error) {
      setErrorMessage(`Save failed. ${error.message}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const activeParameterCount = WEIGHT_FIELDS.filter(
    (field) => Math.abs(Number(formState.weights[field.key] || 0)) > 0.0001,
  ).length;
  const formsRequired = isFormsRequired(formState);
  const priorityWeightFields = WEIGHT_FIELDS.filter(
    (field) => field.key !== "topic_weight" && field.key !== "skill_weight",
  );

  const renderWeightControl = (weightKey, className = "") => {
    const field = getWeightField(weightKey);
    if (!field) {
      return null;
    }

    const value = Number(formState.weights[weightKey] || 0);
    const slider = getWeightSliderBounds(weightKey);
    const description = getWeightDescription(weightKey, value);
    const negativeWarning = getNegativeWeightWarning(weightKey, value);
    const shouldWarnRandomness = weightKey === "randomness" && value > 0.5;
    const requiresStudentFormData = [
      "buddy_weight",
      "mbti_weight",
      "topic_weight",
      "skill_weight",
    ].includes(weightKey);

    return (
      <div
        key={weightKey}
        className={`${styles.criterionCard} ${className}`.trim()}
      >
        <div className={styles.criterionHeader}>
          <div>
            <p className={styles.criterionCode}>{field.label}</p>
            <p className={`${styles.helperText} ${styles.helperTextWithInfo}`}>
              <span>{field.helper}</span>
              {requiresStudentFormData ? (
                <span
                  className={styles.weightInfo}
                  role="img"
                  aria-label="Student form input required"
                  data-tooltip="These inputs are not auto-populated from student records. If weighted, students must submit forms before team formation can use them."
                >
                  <CircleAlert className={styles.weightInfoIcon} />
                </span>
              ) : null}
            </p>
          </div>
          <div className={styles.criterionMeta}>
            <SystemTag tone="neutral">{value.toFixed(2)}</SystemTag>
          </div>
        </div>

        <input
          type="range"
          min={slider.min}
          max={slider.max}
          step={slider.step}
          value={value}
          onChange={(event) => setWeightValue(weightKey, event.target.value)}
          className={styles.sliderInput}
          disabled={isReadOnly}
        />
        <div className={styles.sliderScale}>
          <span>{slider.min}</span>
          <span>{slider.max}</span>
        </div>

        <p className={styles.criterionDescription}>{description}</p>

        {negativeWarning ? (
          <div className={`${styles.inlineWarning} ${styles.fullRow}`}>
            <AlertTriangle className={styles.warningIcon} />
            <span>{negativeWarning}</span>
          </div>
        ) : null}

        {shouldWarnRandomness ? (
          <div className={`${styles.inlineWarning} ${styles.fullRow}`}>
            <AlertTriangle className={styles.warningIcon} />
            <span>
              Randomness above 0.50 increases exploration in the solver and can
              increase the time taken to form teams.
            </span>
          </div>
        ) : null}
      </div>
    );
  };

  const handleSaveAndContinue = async () => {
    setIsPublishingLinks(true);
    setErrorMessage("");
    setSaveMessage("");
    try {
      const saved = await handleSave();
      if (!saved) {
        throw new Error(
          "Unable to save formation-config before notification dispatch.",
        );
      }

      if (!isFormsRequired(formState)) {
        await generateTeamsForSection(groupId);
        setSaveMessage(
          "Criteria saved. No student form fields are required, so team formation started immediately.",
        );
        return;
      }

      const result = await sendFormLinks({"section_id": groupId});
      const data = result?.data || {};
      setSaveMessage(
        `Criteria saved and forms dispatched. Generated ${data.summary?.total_students ?? 0} link(s); notification success: ${data.summary?.success_count ?? 0}, failure: ${data.summary?.failure_count ?? 0}.`,
      );
    } catch (error) {
      setErrorMessage(`Publish failed. ${error.message}`);
    } finally {
      setIsPublishingLinks(false);
    }
  };

  const handleSaveDraft = async () => {
    await handleSave();
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
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Students enrolled</span>
            <div className={styles.staticValue}>{studentCount}</div>
          </div>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Number of groups</span>
            <input
              type="number"
              min="2"
              value={formState.numGroups}
              onChange={(event) => {
                const newNumGroups = Math.max(2, Number(event.target.value) || 2);
                setStateValue(
                  "numGroups",
                  newNumGroups,
                );
              }}
              className={styles.input}
              disabled={isReadOnly}
            />
          </label>
          {studentCount > 0 && formState.numGroups > 0 ? (
            <div className={styles.teamSizeInfo}>
              {(() => {
                const baseSize = Math.floor(studentCount / formState.numGroups);
                const remainder = studentCount % formState.numGroups;
                if (remainder === 0) {
                  return (
                    <p className={styles.infoText}>
                      <strong>{baseSize}</strong> members per group
                    </p>
                  );
                }
                return (
                  <p className={styles.infoText}>
                    <strong>{baseSize}–{baseSize + 1}</strong> members per group
                  </p>
                );
              })()}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      id: "priorities",
      label: "Formation priorities",
      meta: `${activeParameterCount} parameters active`,
      eyebrow: "Weighting",
      title: "Formation priorities",
      description:
        "Tune how much influence each signal should have during team generation.",
      icon: <SlidersHorizontal className={styles.sectionIcon} />,
      metric: activeParameterCount,
      metricLabel: "Parameters active",
      content: (
        <div className={styles.criteriaList}>
          {priorityWeightFields.map((field) => renderWeightControl(field.key))}
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
        <Button onClick={addTopic} variant="default" size="sm" disabled={isReadOnly}>
          <Plus className={styles.buttonIcon} /> Add topic
        </Button>
      ),
      content: (
        <div className={styles.criteriaList}>
          {renderWeightControl("topic_weight", styles.fullRow)}
          {formState.topics.length === 0 && Math.abs(Number(formState.weights?.topic_weight || 0)) > 0.0001 ? (
            <div className={`${styles.inlineWarning} ${styles.fullRow}`}>
              <AlertTriangle className={styles.warningIcon} />
              <span>
                Topic weighting is configured but no project topics are defined. Add one or more topics so the topic weighting can meaningfully influence team formation.
              </span>
            </div>
          ) : null}
          {formState.topics.length > 0 && Math.abs(Number(formState.weights?.topic_weight || 0)) <= 0.0001 ? (
            <div className={`${styles.inlineWarning} ${styles.fullRow}`}>
              <AlertTriangle className={styles.warningIcon} />
              <span>
                Project topics are present, but the topic weight is set to zero. With a zero weight, topics will not affect team formation — raise the topic weighting to have these topics influence results.
              </span>
            </div>
          ) : null}
          {formState.topics.length > 10 ? (
            <div className={`${styles.inlineWarning} ${styles.fullRow}`}>
              <AlertTriangle className={styles.warningIcon} />
              <span>
                More than 10 topics are configured. This increases model size
                and can increase the time taken for team formation.
              </span>
            </div>
          ) : null}

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
                    disabled={isReadOnly}
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
                  disabled={isReadOnly}
                />
              </div>
            ))
          ) : (
            <p className={`${styles.emptyState} ${styles.fullRow}`}>
              No topics added yet.
            </p>
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
        <Button onClick={addSkill} variant="default" size="sm" disabled={isReadOnly}>
          <Plus className={styles.buttonIcon} /> Add skill
        </Button>
      ),
      content: (
        <div className={styles.criteriaList}>
          {renderWeightControl("skill_weight", styles.fullRow)}
          {formState.skills.length === 0 && Math.abs(Number(formState.weights?.skill_weight || 0)) > 0.0001 ? (
            <div className={`${styles.inlineWarning} ${styles.fullRow}`}>
              <AlertTriangle className={styles.warningIcon} />
              <span>
                Skill weighting is configured but no skills are defined. Add one or more skills so the skill weighting can meaningfully influence team formation.
              </span>
            </div>
          ) : null}
          {formState.skills.length > 0 && Math.abs(Number(formState.weights?.skill_weight || 0)) <= 0.0001 ? (
            <div className={`${styles.inlineWarning} ${styles.fullRow}`}>
              <AlertTriangle className={styles.warningIcon} />
              <span>
                Skills are defined, but the skill weight is currently zero. With zero weighting, skills will not be considered during team formation—increase the skill weighting to make these skills count.
              </span>
            </div>
          ) : null}
          {formState.skills.length > 10 ? (
            <div className={`${styles.inlineWarning} ${styles.fullRow}`}>
              <AlertTriangle className={styles.warningIcon} />
              <span>
                More than 10 skills are configured. This increases model size
                and can increase the time taken for team formation.
              </span>
            </div>
          ) : null}

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
                    disabled={isReadOnly}
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
                  disabled={isReadOnly}
                />
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>
                    Skill importance ({Number(skill.skill_importance || 0).toFixed(2)})
                  </span>
                  <input
                    type="range"
                    min="0.05"
                    max="1"
                    step="0.05"
                    value={Number(skill.skill_importance || 0)}
                    onChange={(event) =>
                      updateSkill(skill.id, {
                        skill_importance: Number(event.target.value),
                      })
                    }
                    className={styles.sliderInput}
                    disabled={isReadOnly}
                  />
                  <div className={styles.sliderScale}>
                    <span>0.05</span>
                    <span>1</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className={`${styles.emptyState} ${styles.fullRow}`}>
              No skills added yet.
            </p>
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
            {selectedCourse.code} G{selectedGroup.section_number} -{" "}
            {selectedCourse.name}
          </h2>
        </div>
      </section>

      <div className={styles.statusPanel}>
        <div>
          <p className={styles.statusLabel}>Formation Configuration</p>
          <p className={styles.statusText}> Configuring for 
            <strong> {selectedCourse.code}G{selectedGroup.section_number}</strong>
          </p>
        </div>

        <p className={styles.summaryMeta}>Total Students: {studentCount} students</p>
      </div>

      {errorMessage ? (
        <div className={styles.feedbackAlert}>
          <AlertTriangle className={styles.feedbackIcon} />
          <span>
            {errorMessage} <Link to="/instructor/error-logs">Go to Error Logs</Link>
          </span>
        </div>
      ) : null}

      {saveMessage ? (
        <div className={styles.feedbackSuccess}>{saveMessage}</div>
      ) : null}

      {isFetchingConfig ? (
        <p className={styles.helperText}>Loading saved formation criteria...</p>
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
              {isReadOnly ? (
                <SystemTag tone="neutral">View-only mode</SystemTag>
              ) : null}
            </div>
            {activeSection.content}
          </ModuleBlock>

          <div className={styles.actionRow}>
            <Button
              variant="default"
              onClick={handleSaveDraft}
              disabled={isReadOnly || isSaving || isLoading || isPublishingLinks}
            >
              {isSaving ? "Saving draft..." : "Save Draft"}
            </Button>
            <Button
              variant="success"
              onClick={handleSaveAndContinue}
              disabled={isReadOnly || isSaving || isLoading || isPublishingLinks}
            >
              {isPublishingLinks
                ? formsRequired
                  ? "Saving and publishing..."
                  : "Saving and forming teams..."
                : formsRequired
                  ? "Save and Publish"
                  : "Save and Form Teams"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CreateForm;
