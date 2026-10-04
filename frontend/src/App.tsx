import { MotionConfig } from 'framer-motion'
import { PreferencesProvider } from '@/context/PreferencesContext'
import { usePreferences } from '@/context/preferences'
import { JourneyProvider } from '@/context/JourneyContext'
import { AuthProvider } from '@/context/AuthContext'
import { GuardianProvider } from '@/context/GuardianContext'
import { AppRouter } from '@/router'

function MotionSettings({ children }: { children: React.ReactNode }) {
  const { preferences } = usePreferences()
  return <MotionConfig reducedMotion={preferences.accessibility.reducedMotion ? 'always' : 'user'}>{children}</MotionConfig>
}

export default function App() {
  return (
    <PreferencesProvider>
      <MotionSettings>
        <AuthProvider>
          <GuardianProvider>
            <JourneyProvider>
              <AppRouter />
            </JourneyProvider>
          </GuardianProvider>
        </AuthProvider>
      </MotionSettings>
    </PreferencesProvider>
  )
}
