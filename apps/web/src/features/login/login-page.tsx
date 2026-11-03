import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'
import { ApiClientError, apiClient } from '../../api/client.js'
import { t } from '../../i18n/index.js'
import styles from './login-page.module.css'

const SESSION_QUERY_KEY = ['session']

export function LoginPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const sessionQuery = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: apiClient.getSession,
  })
  const demoSession = useMutation({
    mutationFn: apiClient.createDemoSession,
    onSuccess: () => {
      queryClient.setQueryData(SESSION_QUERY_KEY, { authenticated: true })
      void navigate('/dashboard')
    },
  })

  const demoErrorMessage =
    demoSession.error instanceof ApiClientError
      ? demoSession.error.message
      : t('login.demoError')
  const locationState: unknown = location.state as unknown
  const navigationReason =
    typeof locationState === 'object' &&
    locationState !== null &&
    'reason' in locationState &&
    (locationState.reason === 'session-expired' ||
      locationState.reason === 'logged-out')
      ? locationState.reason
      : null

  return (
    <main className={styles['page']}>
      <section className={styles['card']} aria-labelledby="login-title">
        <p className={styles['eyebrow']}>{t('login.eyebrow')}</p>
        <h1 id="login-title" className={styles['title']}>
          {t('app.title')}
        </h1>
        <p className={styles['intro']}>{t('login.intro')}</p>
        {navigationReason === 'session-expired' ? (
          <p className={styles['error']} role="alert">
            {t('login.sessionExpired')}
          </p>
        ) : navigationReason === 'logged-out' ? (
          <p className={styles['success']} role="status">
            {t('login.loggedOut')}
          </p>
        ) : null}

        <aside className={styles['privacy']} aria-labelledby="privacy-title">
          <h2 id="privacy-title" className={styles['sectionTitle']}>
            {t('login.privacyTitle')}
          </h2>
          <p>{t('login.privacyExplanation')}</p>
        </aside>

        <div className={styles['sessionStatus']} aria-live="polite">
          {sessionQuery.isPending ? (
            <p role="status">{t('login.checkingSession')}</p>
          ) : sessionQuery.isError ? (
            <div className={styles['error']} role="alert">
              <p>{t('login.sessionStatusError')}</p>
              <button
                className={styles['secondaryButton']}
                onClick={() => {
                  void sessionQuery.refetch()
                }}
                type="button"
              >
                {t('login.retry')}
              </button>
            </div>
          ) : sessionQuery.data.authenticated ? (
            <p role="status">{t('login.sessionActive')}</p>
          ) : (
            <p role="status">{t('login.sessionInactive')}</p>
          )}
        </div>

        <button
          className={styles['primaryButton']}
          disabled={demoSession.isPending}
          onClick={() => {
            demoSession.mutate()
          }}
          type="button"
        >
          {demoSession.isPending
            ? t('login.startingDemo')
            : t('login.startDemo')}
        </button>

        {demoSession.isError ? (
          <p className={styles['error']} role="alert">
            {demoErrorMessage}
          </p>
        ) : null}

        {demoSession.isSuccess ? (
          <p className={styles['success']} role="status" aria-live="polite">
            {t('login.demoStarted')}
          </p>
        ) : null}

        <p className={styles['availability']}>{t('login.librusUnavailable')}</p>
      </section>
    </main>
  )
}
