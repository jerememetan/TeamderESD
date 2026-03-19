import { Outlet, useLocation } from 'react-router'
import MechanicalSwitch from '../../components/schematic/MechanicalSwitch'
import styles from './AppShell.module.css'
import { themeVars } from '../../design/theme'

const navItems = [
  {
    to: '/instructor',
    label: 'Instructor',
    code: 'MODE-01',
    match: (pathname) => pathname.startsWith('/instructor'),
  },
  {
    to: '/student',
    label: 'Student',
    code: 'MODE-02',
    match: (pathname) => pathname.startsWith('/student'),
  },
]

function AppShell() {
  const location = useLocation()

  return (
    <div className={styles.shell} style={themeVars}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brandWrap}>
            <p className={styles.brandCode}>[TEAMDER]</p>
            <h1 className={styles.brand}>Teamder</h1>
            <p className={styles.subtitle}>Create fair student teams, one group at a time.</p>
          </div>
          <MechanicalSwitch items={navItems} activePath={location.pathname} />
        </div>
      </header>

      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}

export default AppShell
