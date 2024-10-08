import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';
import { RequestError } from '../helpers/error';
import { PostmarkClient } from '../helpers/postmark';
import { User } from '../models/sql/User';
import { UserRepository } from '../repositories/sql/UserRepository';
import bcrypt from 'bcrypt';
import { ChallengeRepository } from '../repositories/sql/ChallengeRepository';
import { AddressRepository } from '../repositories/sql/AddressRepository';
import { formatAddress } from '../helpers/address';
import { FormattedAddress } from '../helpers/interfaces';
import { Address } from '../models/sql/Address';

const ACCOUNT_VERIFICATION_TEMPLATE_ID = 35812359;
const PASSWORD_RESET_TEMPLATE_ID = 35966741;
const ALERT_PASSWORD_RESET_TEMPLATE_ID = 36484703;
const JWT_EXPIRY_TIME = '3d';
const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 32;
export const SALT_ROUNDS = 10;

export class UserService {
  // Vérifie si le mail renseigné a un format e-mail
  private static _isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static async registerUser(email: string, password: string): Promise<User> {
    if (!UserService._isValidEmail(email)) {
      throw new RequestError(StatusCodes.UNPROCESSABLE_ENTITY, 'invalid_email');
    }
    if (await UserRepository.findByEmail(email)) {
      throw new RequestError(StatusCodes.UNAUTHORIZED, 'user_already_exists');
    }
    if (!UserService._checkPasswordStrength(password)) {
      throw new RequestError(
        StatusCodes.UNPROCESSABLE_ENTITY,
        'invalid_password',
      );
    }

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = UserRepository.build({
      email,
      password: hash,
      resetPasswordAt: new Date(),
    });
    await UserRepository.save(user);

    await UserService.sendVerificationEmail(user, email);

    return user;
  }

  static async sendVerificationEmail(user: User, email: string): Promise<void> {
    if (!UserService._isValidEmail(email)) {
      throw new RequestError(StatusCodes.UNPROCESSABLE_ENTITY, 'invalid_email');
    }

    const challenge = await ChallengeRepository.findByUserAndType(
      user,
      'email',
    );

    if (challenge?.disabled) {
      throw new RequestError(StatusCodes.CONFLICT, 'email_already_verified');
    }

    const emailVerificationToken = crypto.randomBytes(32).toString('hex');

    await ChallengeRepository.saveOrUpdate(challenge, {
      type: 'email',
      token: emailVerificationToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1d
      userId: user.id,
    });

    await PostmarkClient.sendEmail(email, ACCOUNT_VERIFICATION_TEMPLATE_ID, {
      verification_url: `${process.env.WEBAPP_URL}/verify-email?id=${user.id}&token=${emailVerificationToken}`,
    });
  }

  static async verifyEmail(
    user: User,
    token: string,
  ): Promise<{ token: string }> {
    const challenge = await ChallengeRepository.findByUserAndType(
      user,
      'email',
    );

    if (!challenge) {
      throw new RequestError(StatusCodes.INTERNAL_SERVER_ERROR);
    }
    if (challenge.disabled) {
      throw new RequestError(StatusCodes.CONFLICT, 'email_already_verified');
    }
    if (challenge.token !== token) {
      throw new RequestError(StatusCodes.UNAUTHORIZED, 'invalid_token');
    }
    if (challenge.expiresAt < new Date()) {
      throw new RequestError(StatusCodes.UNAUTHORIZED, 'token_expired');
    }

    await ChallengeRepository.update(challenge, { disabled: true });

    return {
      token: UserService.generateAuthToken(user),
    };
  }

  static async sendPasswordResetEmail(email: string): Promise<void> {
    if (!UserService._isValidEmail(email)) {
      throw new RequestError(StatusCodes.UNPROCESSABLE_ENTITY, 'invalid_email');
    }

    const user = await UserRepository.findByEmail(email);
    if (!user) {
      // Let the endpoint return a 200 status code to avoid user enumeration
      return;
    }

    const passwordResetToken = crypto.randomBytes(32).toString('hex');

    const challenge = await ChallengeRepository.findByUserAndType(
      user,
      'password-reset',
    );
    await ChallengeRepository.saveOrUpdate(challenge, {
      type: 'password-reset',
      token: passwordResetToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1d
      userId: user.id,
    });

    await UserRepository.update(user.id, { resetPasswordAt: new Date() });

    await PostmarkClient.sendEmail(email, PASSWORD_RESET_TEMPLATE_ID, {
      email,
      password_reset_url: `${process.env.WEBAPP_URL}/reset-password?id=${user.id}&token=${passwordResetToken}`,
    });
  }

  static async changePassword(
    userId: number,
    newPassword: string,
  ): Promise<User | null> {
    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    return await UserRepository.update(userId, { password: hash });
  }

  static async sendAlertPasswordResetEmail(email: string): Promise<void> {
    if (!UserService._isValidEmail(email)) {
      throw new RequestError(StatusCodes.UNPROCESSABLE_ENTITY, 'invalid_email');
    }

    const user = await UserRepository.findByEmail(email);
    if (!user) {
      // Let the endpoint return a 200 status code to avoid user enumeration
      return;
    }

    const passwordResetToken = crypto.randomBytes(32).toString('hex');

    const challenge = await ChallengeRepository.findByUserAndType(
      user,
      'password-reset',
    );
    await ChallengeRepository.saveOrUpdate(challenge, {
      type: 'password-reset',
      token: passwordResetToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1d
      userId: user.id,
    });

    await UserRepository.update(user.id, { resetPasswordAt: new Date() });

    await PostmarkClient.sendEmail(email, ALERT_PASSWORD_RESET_TEMPLATE_ID, {
      email,
      password_reset_url: `${process.env.WEBAPP_URL}/reset-password?id=${user.id}&token=${passwordResetToken}`,
    });
  }

  static async resetPassword(
    user: User,
    token: string,
    password: string,
  ): Promise<{ token: string }> {
    const challenge = await ChallengeRepository.findByUserAndType(
      user,
      'password-reset',
    );

    if (!challenge) {
      throw new RequestError(StatusCodes.INTERNAL_SERVER_ERROR);
    }
    if (challenge.token !== token) {
      throw new RequestError(StatusCodes.UNAUTHORIZED, 'invalid_token');
    }
    if (challenge.expiresAt < new Date()) {
      throw new RequestError(StatusCodes.UNAUTHORIZED, 'token_expired');
    }

    if (!UserService._checkPasswordStrength(password)) {
      throw new RequestError(
        StatusCodes.UNPROCESSABLE_ENTITY,
        'invalid_password',
      );
    }

    await this.changePassword(user.id, password);
    await ChallengeRepository.update(challenge, { expiresAt: new Date() }); // now

    return {
      token: UserService.generateAuthToken(user),
    };
  }

  static generateAuthToken(user: User): string {
    return jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, {
      expiresIn: JWT_EXPIRY_TIME,
    });
  }

  static async verifyAuthToken(token: string): Promise<User | null> {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        userId: number;
      };
      return await UserRepository.findById(decoded.userId);
    } catch {
      return null;
    }
  }

  // Recommandations de la CNIL
  private static _checkPasswordStrength(password: string): boolean {
    return (
      password.length >= MIN_PASSWORD_LENGTH &&
      password.length <= MAX_PASSWORD_LENGTH &&
      /[^A-Za-z0-9]/.test(password) &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /[0-9]/.test(password)
    );
  }

  static async findAll(): Promise<User[]> {
    return await UserRepository.findAll();
  }

  static async findByEmail(email: string): Promise<User | null> {
    return await UserRepository.findByEmail(email);
  }

  static async update(
    userId: number,
    data: Partial<User>,
  ): Promise<User | null> {
    if (data.email && !UserService._isValidEmail(data.email)) {
      throw new RequestError(StatusCodes.UNPROCESSABLE_ENTITY, 'invalid_email');
    }

    if (data.password) {
      if (!UserService._checkPasswordStrength(data.password)) {
        throw new RequestError(
          StatusCodes.UNPROCESSABLE_ENTITY,
          'invalid_password',
        );
      }
      data.password = await bcrypt.hash(data.password, SALT_ROUNDS);
    }

    return await UserRepository.update(userId, data);
  }

  static async anonymize(userId: number): Promise<void> {
    const user = await UserRepository.update(userId, {
      email: `${new Date().toISOString()}-deleted@email.com`,
      lastName: 'DELETED',
      firstName: 'DELETED',
      phone: '0000000000',
      roles: ['USER'],
    });

    if (!user) {
      throw new RequestError(StatusCodes.NOT_FOUND);
    }

    const challenge = await ChallengeRepository.findByUserAndType(
      user,
      'email',
    );

    if (!challenge) {
      return;
    }

    // Unverify user to further prevent login
    await ChallengeRepository.update(challenge, { disabled: false });
  }

  static async getAddress(
    userId: number,
    type: string,
  ): Promise<FormattedAddress | null> {
    if (!['billing', 'shipping'].includes(type)) {
      throw new RequestError(StatusCodes.UNPROCESSABLE_ENTITY);
    }

    const address = await AddressRepository.findAddressByUserIdAndType(
      userId,
      type,
    );

    if (!address) {
      return null;
    }

    return {
      street: address.street,
      city: address.city,
      zip: address.postal_code,
      name: address.name,
      phone: address.phone,
      state: '',
      country: '',
    };
  }

  static async getAddresses(userId: number): Promise<{
    billing: FormattedAddress | null;
    shipping: FormattedAddress | null;
  }> {
    const billing = await AddressRepository.findAddressByUserIdAndType(
      userId,
      'billing',
    );
    const shipping = await AddressRepository.findAddressByUserIdAndType(
      userId,
      'shipping',
    );

    return {
      billing: billing
        ? {
            street: billing.street,
            city: billing.city,
            zip: billing.postal_code,
            name: billing.name,
            phone: billing.phone,
            state: '',
            country: '',
          }
        : null,
      shipping: shipping
        ? {
            street: shipping.street,
            city: shipping.city,
            zip: shipping.postal_code,
            name: shipping.name,
            phone: shipping.phone,
            state: '',
            country: '',
          }
        : null,
    };
  }

  // address = street + postal code + city
  static async saveAddress(
    userId: number,
    type: 'billing' | 'shipping',
    address: string,
    phone: string,
    name: string,
  ): Promise<{ created: boolean; address: Address }> {
    if (!['billing', 'shipping'].includes(type)) {
      throw new RequestError(StatusCodes.UNPROCESSABLE_ENTITY);
    }

    try {
      const formattedAddress = await formatAddress(address);

      const { created, address: processedAddress } =
        await AddressRepository.createOrUpdate(userId, {
          street: formattedAddress.street,
          city: formattedAddress.city,
          postal_code: formattedAddress.zip,
          phone,
          name,
          type,
          userId,
        });

      return {
        created,
        address: processedAddress,
      };
    } catch (e) {
      throw new RequestError(StatusCodes.UNPROCESSABLE_ENTITY);
    }
  }
}
