import { Link } from 'react-router'
import ModuleBlock from '../../components/schematic/ModuleBlock'
import SystemTag from '../../components/schematic/SystemTag'
import styles from './HomePage.module.css'

function HomePage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.copy}>
          <p className={styles.kicker}>[TACTICAL TEAM FORMATION GRID]</p>
          <h2 className={styles.title}>Build balanced teams like an engineering system, not a guess.</h2>
          <p className={styles.description}>
            Teamder now presents course groups, forms, swaps, and analytics as linked operational modules.
            Every action is framed as a deliberate intervention in the team-generation pipeline.
          </p>
          <div className={styles.actions}>
            <Link className={styles.primaryAction} to="/instructor">Open Instructor Console</Link>
            <Link className={styles.secondaryAction} to="/student">Open Student Console</Link>
          </div>
        </div>

        <ModuleBlock
          componentId="MOD-HOME"
          eyebrow="System Snapshot"
          title="Schematic Overview"
          metric="03"
          metricLabel="Active Console Layers"
        >
          <div className={styles.legend}>
            <SystemTag tone="neutral">Courses</SystemTag>
            <SystemTag tone="success">Group Forms</SystemTag>
            <SystemTag hazard>System Intervention</SystemTag>
          </div>
        </ModuleBlock>
      </section>
    </main>
  )
}

export default HomePage
