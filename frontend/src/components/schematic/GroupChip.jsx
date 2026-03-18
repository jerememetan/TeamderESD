import styles from './GroupChip.module.css'

function GroupChip({ code, meta, tone = 'blue', className = '', style }) {
  return (
    <div className={`${styles.chip} ${styles[tone] || ''} ${className}`.trim()} style={style}>
      <span className={styles.bar} />
      <div className={styles.body}>
        <p className={styles.code}>{code}</p>
        {meta ? <p className={styles.meta}>{meta}</p> : null}
      </div>
    </div>
  )
}

export default GroupChip
