import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { currentStudent, currentStudentTeam, mockCourses, mockForms, mockStudents } from "../../data/mockData";

function FillForm() {
  const { formId } = useParams();
  const navigate = useNavigate();

  // THESE ARE THE DATA THAT NEED TO COME FROM BACKEND LATER
  const studentProfile = currentStudent;
  const activeTeam = currentStudentTeam;
  const courseList = mockCourses;
  const formMap = mockForms;
  const availableFormList = Object.values(formMap);
  const buddyCandidateList = mockStudents.filter(
    (student) => student.id !== studentProfile.id,
  );

  const selectedForm =
    availableFormList.find((form) => form.id === formId) ||
    formMap[formId || ""] ||
    availableFormList[0];
  const [responses, setResponses] = useState({});
  const [buddyRequestStudentId, setBuddyRequestStudentId] = useState("");
  const selectedCourse = courseList.find((course) => course.id === selectedForm?.courseId);
  const selectedGroup = selectedCourse?.groups.find(
    (group) => group.id === selectedForm?.groupId,
  );

  if (!selectedForm) {
    return <div className="max-w-7xl mx-auto px-4 py-8">Form not found</div>;
  }

  const handleSubmit = (event) => {
    event.preventDefault();

    const payload = {
      studentId: studentProfile.id,
      formId: selectedForm.id,
      responses,
      buddyRequestStudentId: selectedForm.allowBuddy
        ? buddyRequestStudentId
        : null,
    };

    console.log("Form responses:", payload);
    alert("Form submitted successfully!");
    navigate("/student");
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        to="/student"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>

      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Group Formation Form
        </h2>
        <p className="text-gray-600">
          {selectedGroup?.code || activeTeam.groupId} - rate yourself from 1 to 5 for each criterion below.
        </p>
      </div>

      <div className="mb-6 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        Scale guide: <span className="font-semibold">1</span> means very weak or
        low confidence, while <span className="font-semibold">5</span> means very
        strong or high confidence.
      </div>

      <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
        <p className="font-medium text-slate-900">Backend data this page will eventually need</p>
        <p className="mt-2">
          logged-in student profile, active published form for the student's
          group, form criteria, buddy candidate list, and the submit-form API to
          save responses and buddy requests.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {selectedForm.criteria.map((criterion, index) => (
          <div
            key={criterion.id}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <label className="block font-medium text-gray-900 mb-4">
              {index + 1}. {criterion.question}
            </label>

            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((score) => (
                <label
                  key={score}
                  className={`flex flex-col items-center justify-center gap-2 rounded-lg border px-3 py-4 cursor-pointer transition-colors ${
                    responses[criterion.id] === score
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name={criterion.id}
                    value={score}
                    checked={responses[criterion.id] === score}
                    onChange={() =>
                      setResponses((currentResponses) => ({
                        ...currentResponses,
                        [criterion.id]: score,
                      }))
                    }
                    className="sr-only"
                    required
                  />
                  <span className="text-lg font-semibold">{score}</span>
                </label>
              ))}
            </div>
          </div>
        ))}

        {selectedForm.allowBuddy && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <label className="block font-medium text-gray-900 mb-2">
              Buddy request
            </label>
            <p className="text-sm text-gray-600 mb-4">
              You may request one student to be grouped with you. This only works
              if both students request each other.
            </p>
            <select
              value={buddyRequestStudentId}
              onChange={(event) => setBuddyRequestStudentId(event.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">No buddy request</option>
              {buddyCandidateList.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-4">
          <button
            type="submit"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Submit Form
          </button>
          <button
            type="button"
            onClick={() => navigate("/student")}
            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default FillForm;
