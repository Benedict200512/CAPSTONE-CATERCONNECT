import { useNavigation } from '@react-navigation/native'
import { useEffect } from 'react'
import { isEmailVerified } from '../lib/auth'

export function useRequireVerified() {
  const navigation = useNavigation<any>()

  useEffect(() => {
    isEmailVerified().then((verified) => {
      if (!verified) {
        navigation.navigate('VerifyEmail')
      }
    })
  }, [])
}