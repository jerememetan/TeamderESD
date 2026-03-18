import motionStyles from './motion.module.css'
import styles from './SystemTag.module.css'

function SystemTag({ children, tone = 'neutral', hazard = false, className = '', style }) {
  const toneClass = hazard ? styles.hazard : styles[tone] || styles.neutral
  const motionClass = hazard || tone === 'alert' ? motionStyles.pulseWarning : ''

  return <span className={`${styles.tag} ${toneClass} ${motionClass} ${className}`.trim()} style={style}>{children}</span>
}

export default SystemTag
