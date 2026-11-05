import { useNavigation } from '@react-navigation/native'
import { useEffect } from 'react'
import { isEmailVerified } from '../lib/auth'

export function useRequireVerified() {
  const navigation = useNavigation<any>()

  useEffect(() => {
    const verified = isEmailVerified()

    if (!verified) {
      navigation.navigate('VerifyEmail')
    }
  }, [navigation])
}