import styles from './ModuleBlock.module.css'

function ModuleBlock({
  componentId,
  eyebrow,
  title,
  metric,
  metricLabel,
  accent = 'blue',
  children,
  actions,
  className = '',
  style,
  ...props
}) {
  return (
    <section className={`${styles.block} ${styles[accent] || ''} ${className}`.trim()} style={style} {...props}>
      <div className={styles.header}>
        <div>
          {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
          {title ? <h3 className={styles.title}>{title}</h3> : null}
        </div>
        {componentId ? <span className={styles.componentId}>[{componentId}]</span> : null}
      </div>
      {metric !== undefined ? (
        <div className={styles.metricWrap}>
          <p className={styles.metric}>{metric}</p>
          {metricLabel ? <p className={styles.metricLabel}>{metricLabel}</p> : null}
        </div>
      ) : null}
      {children ? <div className={styles.content}>{children}</div> : null}
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </section>
  )
}

export default ModuleBlock
