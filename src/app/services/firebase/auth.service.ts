import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  updateProfile,
  sendPasswordResetEmail,
  updatePassword,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';

export type UserRole = 'admin' | 'technicien' | 'user';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: any;
  lastLogin: any;
  photoURL?: string;
  phoneNumber?: string;
  organization?: string;
}

/**
 * Service d'authentification Firebase pour SolarWatch
 */
export class AuthService {
  /**
   * Connexion utilisateur
   */
  static async login(email: string, password: string): Promise<UserProfile> {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Mettre à jour lastLogin
      await setDoc(
        doc(db, 'users', user.uid),
        { lastLogin: serverTimestamp() },
        { merge: true }
      );

      // Récupérer le profil utilisateur
      const profile = await this.getUserProfile(user.uid);
      return profile;
    } catch (error: any) {
      console.error('Erreur de connexion:', error);
      throw new Error(this.getAuthErrorMessage(error.code));
    }
  }

  /**
   * Inscription d'un nouvel utilisateur (Admin uniquement)
   */
  static async register(
    email: string,
    password: string,
    displayName: string,
    role: UserRole = 'user'
  ): Promise<UserProfile> {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Mettre à jour le profil
      await updateProfile(user, { displayName });

      // Créer le document utilisateur dans Firestore
      const userProfile: UserProfile = {
        uid: user.uid,
        email: user.email!,
        displayName,
        role,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
      };

      await setDoc(doc(db, 'users', user.uid), userProfile);

      return userProfile;
    } catch (error: any) {
      console.error('Erreur d\'inscription:', error);
      throw new Error(this.getAuthErrorMessage(error.code));
    }
  }

  /**
   * Déconnexion
   */
  static async logout(): Promise<void> {
    try {
      await signOut(auth);
    } catch (error: any) {
      console.error('Erreur de déconnexion:', error);
      throw new Error('Erreur lors de la déconnexion');
    }
  }

  /**
   * Récupérer le profil utilisateur depuis Firestore
   */
  static async getUserProfile(uid: string): Promise<UserProfile> {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      
      if (!userDoc.exists()) {
        throw new Error('Profil utilisateur non trouvé');
      }

      return userDoc.data() as UserProfile;
    } catch (error) {
      console.error('Erreur récupération profil:', error);
      throw error;
    }
  }

  /**
   * Observer les changements d'état d'authentification
   */
  static onAuthStateChange(callback: (user: User | null) => void) {
    return onAuthStateChanged(auth, callback);
  }

  /**
   * Réinitialiser le mot de passe
   */
  static async resetPassword(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      console.error('Erreur réinitialisation:', error);
      throw new Error(this.getAuthErrorMessage(error.code));
    }
  }

  /**
   * Changer le mot de passe
   */
  static async changePassword(newPassword: string): Promise<void> {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Utilisateur non connecté');
      
      await updatePassword(user, newPassword);
    } catch (error: any) {
      console.error('Erreur changement mot de passe:', error);
      throw new Error(this.getAuthErrorMessage(error.code));
    }
  }

  /**
   * Vérifier les permissions selon le rôle
   */
  static hasPermission(userRole: UserRole, requiredRole: UserRole): boolean {
    const roleHierarchy: Record<UserRole, number> = {
      admin: 3,
      technicien: 2,
      user: 1,
    };

    return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
  }

  /**
   * Messages d'erreur en français
   */
  private static getAuthErrorMessage(errorCode: string): string {
    const errorMessages: Record<string, string> = {
      'auth/email-already-in-use': 'Cette adresse email est déjà utilisée',
      'auth/invalid-email': 'Adresse email invalide',
      'auth/operation-not-allowed': 'Opération non autorisée',
      'auth/weak-password': 'Mot de passe trop faible (minimum 6 caractères)',
      'auth/user-disabled': 'Ce compte a été désactivé',
      'auth/user-not-found': 'Aucun compte trouvé avec cet email',
      'auth/wrong-password': 'Mot de passe incorrect',
      'auth/too-many-requests': 'Trop de tentatives. Réessayez plus tard',
      'auth/network-request-failed': 'Erreur de connexion réseau',
    };

    return errorMessages[errorCode] || 'Erreur d\'authentification';
  }
}
