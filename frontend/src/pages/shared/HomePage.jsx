import { Link } from 'react-router'
import ModuleBlock from '../../components/schematic/ModuleBlock'
import SystemTag from '../../components/schematic/SystemTag'
import styles from './HomePage.module.css'

function HomePage() {
  return (
    <main className={styles.page}>

        <div className={styles.copy}>
          <p className={styles.kicker}>Welcome to TeamDer!</p>
          <h6 className={styles.title}>A Group Formation Tool for instructors</h6>
          <p className={styles.description}>
            Teamder is a group management system for instructors to create, manage groupings for different courses.
          </p>
          <div className={styles.actions}>
            <Link className={styles.secondaryAction} to="/instructor">Instructor View</Link>
            <Link className={styles.secondaryAction} to="/student">Student View</Link>
          </div>
        </div>


    </main>
  )
}

export default HomePage
