import { Link } from 'react-router';
import { FileText, Users, ArrowRight, CheckCircle, Clock } from 'lucide-react';
import { currentStudent, currentStudentTeam, mockForms } from "../../data/mockData";

function StudentDashBoard(){
    // THESE ARE THE DATA THAT NEEDS TO BE TAKEN UP, CURRENTLY TAKEN FROM MOCK DATA
    const studentProfile = currentStudent
    const activeTeam = currentStudentTeam
    const formMap = mockForms
    const availableFormList = Object.values(formMap)
    const activeForm = availableFormList[0] || null

    const activeTeamCount = activeTeam ? 1 : 0
    const completedFormsCount = availableFormList.length
    const pendingRequestsCount = 0
    const formHistoryItems = [
      {
        id: 'team-formation-fall-2026',
        title: 'Team Formation Survey - Fall 2026',
        completedAtLabel: 'Completed on March 5, 2026',
        statusLabel: 'Completed',
      },
    ]

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Student Dashboard</h2>
        <p className="text-gray-600">Welcome back, {studentProfile.name}!</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-8 h-8 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{activeTeamCount}</p>
          <p className="text-sm text-gray-600">Active Team</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <FileText className="w-8 h-8 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{completedFormsCount}</p>
          <p className="text-sm text-gray-600">Forms Completed</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-8 h-8 text-orange-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{pendingRequestsCount}</p>
          <p className="text-sm text-gray-600">Pending Requests</p>
        </div>
      </div>
       {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Link
          to="/student/team"
          className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow group"
        >
          <Users className="w-10 h-10 text-blue-600 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">My Team</h3>
          <p className="text-sm text-gray-600 mb-4">
            View your current team members and request team swaps
          </p>
          <div className="flex items-center text-blue-600 text-sm font-medium group-hover:gap-2 transition-all">
            View Team <ArrowRight className="w-4 h-4 ml-1" />
          </div>
        </Link>

        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
          <FileText className="w-10 h-10 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Available Forms</h3>
          <p className="text-sm text-gray-600 mb-4">
            Complete the active group formation form for your course.
          </p>
          <Link
            to={activeForm ? `/student/form/${activeForm.id}` : "/student"}
            className="inline-flex items-center text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            Fill Form <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </div>
      </div>

      {/* Current Team */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900">Current Team</h3>
          <Link
            to="/student/team"
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            View Details →
          </Link>
        </div>

        <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
          <div>
            <h4 className="font-semibold text-gray-900 text-lg mb-1">
              {activeTeam.name}
            </h4>
            <p className="text-sm text-gray-600">
              {activeTeam.members.length} members
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {activeTeam.formationScore}
              </p>
              <p className="text-xs text-gray-600">Team Score</p>
            </div>
          </div>
        </div>
      </div>

      {/* Form History */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">Form History</h3>

        <div className="space-y-4">
          {formHistoryItems.map((formItem) => (
            <div key={formItem.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">
                    {formItem.title}
                  </h4>
                  <p className="text-sm text-gray-600">{formItem.completedAtLabel}</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                {formItem.statusLabel}
              </span>
            </div>
          ))}
        </div>
      </div>
      </div>
    )
}

export default StudentDashBoard
