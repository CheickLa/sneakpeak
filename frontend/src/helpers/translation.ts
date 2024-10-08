export interface IError {
  name: string
  message: string
  error: string
}
export class Translation {
  /**
   * @param message Erreur de connexion en anglais
   * @returns Erreur de connexion en français
   */
  static loginErrors(message: Error) {
    switch ((message as IError).error) {
      case 'invalid_credentials':
        return 'Identifiants incorrects'

      case 'email_not_verified':
        return 'Adresse mail non vérifiée'

      case 'account_locked':
        return 'Compte bloqué. Veuillez réessayer plus tard'

      default:
        break
    }
  }

  /**
   * @param message Erreur d'inscription en anglais
   * @returns Erreur d'inscription en français
   */
  static registerErrors(message: Error) {
    switch ((message as IError).error) {
      case 'user_already_exists':
        return 'Cette adresse mail est déjà utilisée'

      case 'invalid_password':
        return 'Votre mot de passe doit contenir au moins 12 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial'

      default:
        return 'Une erreur est survenue. Veuillez réessayer'
    }
  }

  static profileErrors(message: Error) {
    switch ((message as IError).error) {
      case 'user_not_found':
        return 'Utilisateur non trouvé'

      case 'invalid_password':
        return 'Votre mot de passe doit contenir au moins 12 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial'

      default:
        return 'Une erreur est survenue. Veuillez réessayer'
    }
  }

  /**
   * @param message Erreur de connexion en anglais
   * @returns Erreur de connexion en français
   */
  static sessionErrors(message: Error) {
    switch ((message as IError).error) {
      case 'not_logged_in':
        return "Vous n'êtes pas connecté"

      default:
        return 'Une erreur est survenue. Veuillez réessayer'
    }
  }

  /**
   * @param message Erreur CRUD variante en anglais
   * @returns Erreur CRUD variante en français
   */
  static variantsErrors(message: Error) {
    switch ((message as IError).error) {
      case 'Variant already exists':
        return "Opération impossible cette variante existe déjà"
      case 'Variant not found':
        return "Opération impossible cette variante n'existe pas"

      default:
        return 'Une erreur est survenue. Veuillez réessayer avec une image moins lourde'
    }
  }
}
