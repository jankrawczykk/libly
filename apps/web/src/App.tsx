import styles from './App.module.css'
import { t } from './i18n/index.js'

export function App() {
  return (
    <main className={styles['main']}>
      <h1 className={styles['title']}>{t('app.title')}</h1>
      <p className={styles['status']}>{t('app.foundationStatus')}</p>
    </main>
  )
}
