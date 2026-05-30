import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { UserProfile, UserRole } from './auth.service';

/**
 * Service de gestion des utilisateurs
 */
export class UserService {
  /**
   * Récupérer tous les utilisateurs (Admin uniquement)
   */
  static async getAllUsers(): Promise<UserProfile[]> {
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      return usersSnapshot.docs.map(doc => doc.data() as UserProfile);
    } catch (error) {
      console.error('Erreur récupération utilisateurs:', error);
      return [];
    }
  }

  /**
   * Récupérer un utilisateur par ID
   */
  static async getUserById(uid: string): Promise<UserProfile | null> {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        return userDoc.data() as UserProfile;
      }
      return null;
    } catch (error) {
      console.error('Erreur récupération utilisateur:', error);
      return null;
    }
  }

  /**
   * Mettre à jour le profil utilisateur
   */
  static async updateUserProfile(
    uid: string,
    updates: Partial<UserProfile>
  ): Promise<void> {
    try {
      await updateDoc(doc(db, 'users', uid), {
        ...updates,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Erreur mise à jour profil:', error);
      throw error;
    }
  }

  /**
   * Changer le rôle d'un utilisateur (Admin uniquement)
   */
  static async changeUserRole(uid: string, newRole: UserRole): Promise<void> {
    try {
      await updateDoc(doc(db, 'users', uid), {
        role: newRole,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Erreur changement rôle:', error);
      throw error;
    }
  }

  /**
   * Désactiver un utilisateur (Admin uniquement)
   */
  static async deactivateUser(uid: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'users', uid), {
        active: false,
        deactivatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Erreur désactivation utilisateur:', error);
      throw error;
    }
  }

  /**
   * Activer un utilisateur (Admin uniquement)
   */
  static async activateUser(uid: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'users', uid), {
        active: true,
        activatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Erreur activation utilisateur:', error);
      throw error;
    }
  }

  /**
   * Supprimer un utilisateur (Admin uniquement)
   */
  static async deleteUser(uid: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'users', uid));
    } catch (error) {
      console.error('Erreur suppression utilisateur:', error);
      throw error;
    }
  }

  /**
   * Récupérer les utilisateurs par rôle
   */
  static async getUsersByRole(role: UserRole): Promise<UserProfile[]> {
    try {
      const q = query(
        collection(db, 'users'),
        where('role', '==', role),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data() as UserProfile);
    } catch (error) {
      console.error('Erreur récupération par rôle:', error);
      return [];
    }
  }

  /**
   * Compter les utilisateurs par rôle
   */
  static async countUsersByRole(): Promise<Record<UserRole, number>> {
    try {
      const users = await this.getAllUsers();
      return users.reduce(
        (acc, user) => {
          acc[user.role]++;
          return acc;
        },
        { admin: 0, technicien: 0, user: 0 } as Record<UserRole, number>
      );
    } catch (error) {
      console.error('Erreur comptage utilisateurs:', error);
      return { admin: 0, technicien: 0, user: 0 };
    }
  }
}
