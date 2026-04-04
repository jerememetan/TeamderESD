import { useEffect, useMemo, useState } from "react";
import {
  fetchStudentFormAssignments,
  fetchStudentFormPage,
} from "../../../../services/studentFormPageGraphqlService";

const DEFAULT_FIELD_VISIBILITY = {
  mbtiEnabled: false,
  buddyEnabled: false,
  buddyWeight: 0,
  skillEnabled: false,
  topicEnabled: false,
};

export function useFillFormPage({
  formId,
  activeStudent,
  activeStudentRouteId,
  isLoadingStudents,
  navigate,
}) {
  const [availableForms, setAvailableForms] = useState([]);
  const [formsError, setFormsError] = useState("");
  const [isLoadingForms, setIsLoadingForms] = useState(true);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [isLoadingBuddyOptions, setIsLoadingBuddyOptions] = useState(false);
  const [formLoadError, setFormLoadError] = useState("");
  const [formationConfig, setFormationConfig] = useState(null);
  const [fieldVisibility, setFieldVisibility] = useState(
    DEFAULT_FIELD_VISIBILITY,
  );
  const [buddyOptions, setBuddyOptions] = useState([]);
  const [buddyRequestStudentId, setBuddyRequestStudentId] = useState("");
  const [mbti, setMbti] = useState("");
  const [skillScores, setSkillScores] = useState({});
  const [topicRankings, setTopicRankings] = useState({});
  const [formSubmissionError, setFormSubmissionError] = useState("");

  useEffect(() => {
    if (isLoadingStudents || !activeStudent) {
      setAvailableForms([]);
      setIsLoadingForms(isLoadingStudents);
      return;
    }

    let ignore = false;

    async function loadForms() {
      setIsLoadingForms(true);
      setFormsError("");

      try {
        const backendStudentId = Number(activeStudent.backendStudentId);
        if (!Number.isFinite(backendStudentId)) {
          throw new Error(
            "Unable to resolve a backend student id for the selected student.",
          );
        }

        const forms = await fetchStudentFormAssignments({
          studentId: backendStudentId,
        });
        if (ignore) {
          return;
        }

        setAvailableForms(forms);
      } catch (error) {
        if (ignore) {
          return;
        }
        setAvailableForms([]);
        setFormsError(
          error?.message || "Unable to load forms for this student.",
        );
      } finally {
        if (!ignore) {
          setIsLoadingForms(false);
        }
      }
    }

    loadForms();

    return () => {
      ignore = true;
    };
  }, [activeStudent?.backendStudentId, isLoadingStudents]);

  const availableFormList = useMemo(
    () => availableForms.filter((form) => !form.submitted),
    [availableForms],
  );
  const resolvedForm = formId
    ? availableForms.find((form) => form.id === formId)
    : null;
  const chooserMode = !formId;
  const studentBasePath = `/student/${activeStudentRouteId}`;

  const resolvedAssignmentLabel = resolvedForm?.title || "Course form";

  const sectionSkills = Array.isArray(formationConfig?.skills)
    ? formationConfig.skills
    : [];
  const sectionTopics = Array.isArray(formationConfig?.topics)
    ? formationConfig.topics
    : [];
  const shouldCollectSkills =
    fieldVisibility.skillEnabled && sectionSkills.length > 0;
  const shouldCollectTopics =
    fieldVisibility.topicEnabled && sectionTopics.length > 0;
  const shouldCollectMbti = fieldVisibility.mbtiEnabled;
  const shouldCollectBuddy = fieldVisibility.buddyEnabled;

  useEffect(() => {
    if (!formId || isLoadingForms || !resolvedForm?.submitted) {
      return;
    }

    const redirectHandle = window.setTimeout(() => {
      navigate(studentBasePath);
    }, 2500);

    return () => {
      window.clearTimeout(redirectHandle);
    };
  }, [
    formId,
    isLoadingForms,
    navigate,
    resolvedForm?.submitted,
    studentBasePath,
  ]);

  useEffect(() => {
    let isMounted = true;

    async function loadSectionFormationConfig() {
      if (!resolvedForm || !activeStudent || resolvedForm.submitted) {
        setFormationConfig(null);
        setFieldVisibility(DEFAULT_FIELD_VISIBILITY);
        setBuddyOptions([]);
        setIsLoadingBuddyOptions(false);
        setSkillScores({});
        setTopicRankings({});
        setBuddyRequestStudentId("");
        setMbti("");
        setFormLoadError("");
        return;
      }

      const sectionId = resolvedForm.sectionId;
      const activeStudentId = Number(activeStudent.backendStudentId);

      setIsLoadingConfig(true);
      setIsLoadingBuddyOptions(true);
      setFormLoadError("");
      setFormSubmissionError("");
      setBuddyRequestStudentId("");
      setMbti("");
      setBuddyOptions([]);

      try {
        const pageData = await fetchStudentFormPage({
          studentId: activeStudentId,
          sectionId,
        });

        if (!isMounted) {
          return;
        }

        if (!pageData?.sectionId) {
          throw new Error(
            "Unable to resolve a valid section for this student form.",
          );
        }

        const nextVisibility = {
          mbtiEnabled: Boolean(pageData?.fieldVisibility?.mbtiEnabled),
          buddyEnabled: Boolean(pageData?.fieldVisibility?.buddyEnabled),
          buddyWeight: Number(pageData?.fieldVisibility?.buddyWeight ?? 0),
          skillEnabled: Boolean(pageData?.fieldVisibility?.skillEnabled),
          topicEnabled: Boolean(pageData?.fieldVisibility?.topicEnabled),
        };

        const skills = Array.isArray(pageData?.skillCatalog)
          ? pageData.skillCatalog
              .map((skill) => ({
                skill_id: String(skill?.value || "").trim(),
                skill_label: String(skill?.label || "Skill").trim() || "Skill",
              }))
              .filter((skill) => Boolean(skill.skill_id))
          : [];

        const topics = Array.isArray(pageData?.topicCatalog)
          ? pageData.topicCatalog
              .map((topic) => ({
                topic_id: String(topic?.value || "").trim(),
                topic_label:
                  String(topic?.label || "Project topic").trim() ||
                  "Project topic",
              }))
              .filter((topic) => Boolean(topic.topic_id))
          : [];

        setAvailableForms((currentForms) => {
          let hasChanged = false;
          const nextForms = currentForms.map((form) => {
            if (form.id !== resolvedForm.id) {
              return form;
            }

            const nextSectionId = String(pageData.sectionId);
            const nextSubmitted = Boolean(pageData.submitted);
            if (
              String(form.sectionId) === nextSectionId &&
              Boolean(form.submitted) === nextSubmitted
            ) {
              return form;
            }

            hasChanged = true;
            return {
              ...form,
              sectionId: nextSectionId,
              submitted: nextSubmitted,
            };
          });

          return hasChanged ? nextForms : currentForms;
        });

        setFormationConfig({
          section_id: pageData.sectionId,
          skills,
          topics,
        });
        setFieldVisibility(nextVisibility);
        setSkillScores(
          skills.reduce((acc, skill) => {
            if (skill?.skill_id) {
              acc[String(skill.skill_id)] = "";
            }
            return acc;
          }, {}),
        );
        setTopicRankings(
          topics.reduce((acc, topic) => {
            if (topic?.topic_id) {
              acc[String(topic.topic_id)] = "";
            }
            return acc;
          }, {}),
        );

        setBuddyOptions(
          nextVisibility.buddyEnabled && Array.isArray(pageData?.buddyOptions)
            ? pageData.buddyOptions
                .map((option) => ({
                  value: String(option?.value || "").trim(),
                  label:
                    String(option?.label || "").trim() ||
                    `Student ${option?.value}`,
                }))
                .filter((option) => Boolean(option.value))
                .sort((left, right) => left.label.localeCompare(right.label))
            : [],
        );
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setFormationConfig(null);
        setFieldVisibility(DEFAULT_FIELD_VISIBILITY);
        setSkillScores({});
        setTopicRankings({});
        setBuddyOptions([]);
        setFormLoadError(
          error?.message || "Unable to load section form configuration.",
        );
      } finally {
        if (isMounted) {
          setIsLoadingConfig(false);
          setIsLoadingBuddyOptions(false);
        }
      }
    }

    loadSectionFormationConfig();

    return () => {
      isMounted = false;
    };
  }, [
    activeStudent?.backendStudentId,
    resolvedForm?.id,
    resolvedForm?.sectionId,
    resolvedForm?.submitted,
  ]);

  const availableFormCount = availableFormList.length;

  const updateSkillScore = (skillId, value) => {
    setSkillScores((current) => ({ ...current, [skillId]: value }));
  };

  const updateTopicRank = (topicId, value) => {
    setTopicRankings((current) => ({ ...current, [topicId]: value }));
  };

  return {
    availableForms,
    formsError,
    isLoadingForms,
    isLoadingConfig,
    isLoadingBuddyOptions,
    formLoadError,
    fieldVisibility,
    buddyOptions,
    buddyRequestStudentId,
    setBuddyRequestStudentId,
    mbti,
    setMbti,
    skillScores,
    topicRankings,
    formSubmissionError,
    setFormSubmissionError,
    availableFormList,
    availableFormCount,
    resolvedForm,
    chooserMode,
    studentBasePath,
    resolvedAssignmentLabel,
    sectionSkills,
    sectionTopics,
    shouldCollectSkills,
    shouldCollectTopics,
    shouldCollectMbti,
    shouldCollectBuddy,
    updateSkillScore,
    updateTopicRank,
  };
}
