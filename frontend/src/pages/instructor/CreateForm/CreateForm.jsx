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
  backendSectionIds,
} from "../../../data/backendIds";
import { mockCourses, mockForms } from "../../../data/mockData";
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
function CreateForm() {
  // takes course Id and Group ID from the params (already configured)
  const { courseId, groupId } = useParams();
  // Resolve selected course/group from params. Support frontend codes/ids
  // fetchEnrollmentCountBySectionId
  const resolved = (() => {
    let course =
      mockCourses.find((c) => c.code === courseId) ||
      mockCourses.find((c) => c.id === courseId) ||
      null;
    let frontendGroupId = groupId;

    if (!course) {
      // If `groupId` looks like a backend UUID, reverse-lookup frontend key
      const frontendKey = Object.keys(backendSectionIds).find(
        (k) => backendSectionIds[k] === groupId,
      );
      if (frontendKey) {
        frontendGroupId = frontendKey;
        course =
          mockCourses.find((c) => c.groups.some((g) => g.id === frontendKey)) ||
          null;
      }

      // fallback: find a course containing the provided groupId directly
      if (!course) {
        course =
          mockCourses.find((c) => c.groups.some((g) => g.id === groupId)) ||
          null;
      }
    }

    return { course, frontendGroupId };
  })();

  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const existingForm = mockForms[resolved.frontendGroupId || ""];

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
  const [studentCount, setStudentCount] = useState(0);
  
  
  useEffect(() => {
    async function fetchStudentCount() {
      try {
        const res = await fetchEnrollmentCountBySectionId(groupId);
        setStudentCount(res);
      } catch (error) {
        console.log("EnrollmentCountPullFailed:" + error);
      }
    }
    
    fetchStudentCount();
    console.log("STUDENT COUNT", studentCount);
  }, [groupId]);

  useEffect(() => {
    async function fetchCourse() {
      try {
        const course = await fetchCourseByCode(courseId);
        setSelectedCourse(course);
      } catch (error) {
        console.log("course not found: " + courseId, error);
      }
    }
    
    fetchCourse();
    console.log("SELECTED COURSE", selectedCourse);
  }, [courseId]);

  useEffect(() => {
    async function fetchSection() {
      try {
        const section = await getSectionById(groupId);
        setSelectedGroup(section);
      } catch (error) {
        console.log("section not found:" + error);
      }
    }
    fetchSection();
    console.log("SELECTED GROUP", selectedGroup);
  }, [selectedCourse]);


  useEffect(() => {
    let isMounted = true;
    // loads config
    async function loadConfig() {
      if (!selectedCourse || !selectedGroup) {
        return;
      }
      setIsLoading(true);
      setErrorMessage("");
      setSaveMessage("");
      // tries to get Course Id but if it fails it will use a mock source
      if (!courseId || !courseId) {
        setLoadSource("mock");
        setIsLoading(false);
        setErrorMessage("Missing backend UUID mapping for this course group.");
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
  }, [defaultState, selectedCourse, selectedGroup]);
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

  const handleSave = async (mode) => {
    setIsSaving(true);
    setSaveMessage("");
    setErrorMessage("");
    const backendCourseId =
      // prefer actual backend UUIDs returned from the course service
      (selectedCourse && (selectedCourse.id || selectedCourse.course_id)) ||
      // fallback to static mapping
      getBackendCourseId(courseId) ||
      null;

    const backendSectionId =
      // prefer actual backend UUID returned from the section service
      (selectedGroup && (selectedGroup.id || selectedGroup.section_id)) ||
      // fallback to static mapping using the frontend group key
      getBackendSectionId(resolved.frontendGroupId || groupId) ||
      groupId ||
      null;

    const payload = buildSavePayload(
      formState,
      backendCourseId,
      backendSectionId,
    );
    try {
      await saveFormationConfig(payload);
      console.log("SUBMITTED PAYLOAD", payload);
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
  const activeParameterCount = WEIGHT_FIELDS.filter(
    (field) => Math.abs(Number(formState.weights[field.key] || 0)) > 0.0001,
  ).length;
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

    return (
      <div
        key={weightKey}
        className={`${styles.criterionCard} ${className}`.trim()}
      >
        <div className={styles.criterionHeader}>
          <div>
            <p className={styles.criterionCode}>{field.label}</p>
            <p className={styles.helperText}>{field.helper}</p>
          </div>
          <SystemTag tone="neutral">{value.toFixed(2)}</SystemTag>
        </div>

        <input
          type="range"
          min={slider.min}
          max={slider.max}
          step={slider.step}
          value={value}
          onChange={(event) => setWeightValue(weightKey, event.target.value)}
          className={styles.sliderInput}
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

  const handlePublish = async () => {
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
      // just need a JSON of section_id : your actual section id
      const result = await sendFormLinks({ "section_id": groupId });
      const data = result || {};
      console.log("PUBLISH OUTPUT",data);
      setSaveMessage(
        `Published. Generated ${data.summary.total_students ?? 0} link(s); notification success: ${data.summary.success_count ?? 0}, failure: ${data.summary.failure_count ?? 0}.`,
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
        <Button onClick={addTopic} variant="default" size="sm">
          <Plus className={styles.buttonIcon} /> Add topic
        </Button>
      ),
      content: (
        <div className={styles.criteriaList}>
          {renderWeightControl("topic_weight", styles.fullRow)}
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
        <Button onClick={addSkill} variant="default" size="sm">
          <Plus className={styles.buttonIcon} /> Add skill
        </Button>
      ),
      content: (
        <div className={styles.criteriaList}>
          {renderWeightControl("skill_weight", styles.fullRow)}
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
          <p className={styles.statusLabel}>Form Creation</p>
          <p className={styles.statusText}> Creating form for 
            <strong> {selectedCourse.code}G{selectedGroup.section_number}</strong>
          </p>
        </div>

        <p className={styles.summaryMeta}>Total Students: {studentCount} students</p>
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
