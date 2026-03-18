import { Link } from 'react-router'
import styles from './MechanicalSwitch.module.css'

function MechanicalSwitch({ items, activePath }) {
  return (
    <div className={styles.switchWrap}>
      {items.map((item) => {
        const active = item.match(activePath)

        return (
          <Link
            key={item.to}
            to={item.to}
            className={`${styles.switchOption} ${active ? styles.active : ''}`}
          >
            <span className={styles.label}>{item.label}</span>
            <span className={styles.code}>{item.code}</span>
          </Link>
        )
      })}
    </div>
  )
}

export default MechanicalSwitch
