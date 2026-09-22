import { randomBytes } from "node:crypto";
import type { User } from "../../generated/prisma/client.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { ApiError, ErrorCode } from "../../shared/errors.js";
import {
  createUser,
  findActiveUserById,
  findUserByEmail,
  findUserByIdentifier,
  findUserByUsername,
  softDeleteUser,
  updateUserPassword,
  updateUserProfile,
} from "./auth.repository.js";
import {
  normalizeEmail,
  type ChangePasswordInput,
  type LoginInput,
  type RegisterInput,
  type UpdateProfileInput,
} from "./auth.validation.js";
import type { UserProfileDto } from "./auth.types.js";

function isUniqueConstraintError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  return (error as { code?: unknown }).code === "P2002";
}

function uniqueConstraintField(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  const meta = (error as { meta?: unknown }).meta;

  if (typeof meta !== "object" || meta === null) {
    return undefined;
  }

  const target = (meta as { target?: unknown }).target;

  if (Array.isArray(target) && typeof target[0] === "string") {
    return target[0];
  }

  if (typeof target === "string") {
    return target;
  }

  return undefined;
}

async function throwDuplicateRegistrationError(
  error: unknown,
  username: string,
  email: string,
): Promise<never> {
  const field = uniqueConstraintField(error);

  if (field === "username") {
    throw new ApiError(
      409,
      ErrorCode.USERNAME_TAKEN,
      "Username is already taken",
    );
  }

  if (field === "email") {
    throw new ApiError(
      409,
      ErrorCode.EMAIL_TAKEN,
      "Email is already registered",
    );
  }

  const byUsername = await findUserByUsername(username);
  if (byUsername) {
    throw new ApiError(
      409,
      ErrorCode.USERNAME_TAKEN,
      "Username is already taken",
    );
  }

  const byEmail = await findUserByEmail(email);
  if (byEmail) {
    throw new ApiError(
      409,
      ErrorCode.EMAIL_TAKEN,
      "Email is already registered",
    );
  }

  throw new ApiError(
    409,
    ErrorCode.USERNAME_TAKEN,
    "Username is already taken",
  );
}

export async function register(input: RegisterInput): Promise<User> {
  const email = normalizeEmail(input.email);

  const existingUsername = await findUserByUsername(input.username);
  if (existingUsername) {
    throw new ApiError(
      409,
      ErrorCode.USERNAME_TAKEN,
      "Username is already taken",
    );
  }

  const existingEmail = await findUserByEmail(email);
  if (existingEmail) {
    throw new ApiError(
      409,
      ErrorCode.EMAIL_TAKEN,
      "Email is already registered",
    );
  }

  const passwordHash = await hashPassword(input.password);

  try {
    return await createUser({ username: input.username, email, passwordHash });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw await throwDuplicateRegistrationError(error, input.username, email);
    }

    throw error;
  }
}

export async function login(input: LoginInput): Promise<User> {
  const user = await findUserByIdentifier(input.identifier);

  if (!user) {
    throw new ApiError(
      401,
      ErrorCode.INVALID_CREDENTIALS,
      "Invalid credentials",
    );
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    throw new ApiError(
      401,
      ErrorCode.INVALID_CREDENTIALS,
      "Invalid credentials",
    );
  }

  return user;
}

export async function getCurrentUser(userId: string): Promise<User> {
  const user = await findActiveUserById(userId);

  if (!user) {
    throw new ApiError(
      401,
      ErrorCode.AUTHENTICATION_REQUIRED,
      "Authentication required",
    );
  }

  return user;
}

function authenticationRequired(): ApiError {
  return new ApiError(
    401,
    ErrorCode.AUTHENTICATION_REQUIRED,
    "Authentication required",
  );
}

export async function updateCurrentUser(
  userId: string,
  input: UpdateProfileInput,
): Promise<User> {
  const current = await getCurrentUser(userId);
  const email =
    input.email === undefined ? undefined : normalizeEmail(input.email);

  if (input.username !== undefined && input.username !== current.username) {
    const existing = await findUserByUsername(input.username);
    if (existing && existing.id !== userId) {
      throw new ApiError(
        409,
        ErrorCode.USERNAME_TAKEN,
        "Username is already taken",
      );
    }
  }

  if (email !== undefined && email !== current.email) {
    const existing = await findUserByEmail(email);
    if (existing && existing.id !== userId) {
      throw new ApiError(
        409,
        ErrorCode.EMAIL_TAKEN,
        "Email is already registered",
      );
    }
  }

  try {
    const user = await updateUserProfile(userId, {
      ...(input.username === undefined ? {} : { username: input.username }),
      ...(email === undefined ? {} : { email }),
    });
    if (!user) throw authenticationRequired();
    return user;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const field = uniqueConstraintField(error);
      if (field === "email") {
        throw new ApiError(
          409,
          ErrorCode.EMAIL_TAKEN,
          "Email is already registered",
        );
      }
      throw new ApiError(
        409,
        ErrorCode.USERNAME_TAKEN,
        "Username is already taken",
      );
    }
    throw error;
  }
}

export async function changePassword(
  userId: string,
  input: ChangePasswordInput,
): Promise<void> {
  const user = await getCurrentUser(userId);
  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw new ApiError(
      401,
      ErrorCode.INVALID_CREDENTIALS,
      "Current password is incorrect",
    );
  }

  const updated = await updateUserPassword(
    userId,
    await hashPassword(input.newPassword),
  );
  if (!updated) throw authenticationRequired();
}

export async function deleteCurrentUser(userId: string): Promise<void> {
  await getCurrentUser(userId);

  const token = randomBytes(16).toString("hex");
  const deleted = await softDeleteUser(userId, {
    username: `del_${token.slice(0, 26)}`,
    email: `deleted+${token}@deleted.invalid`,
    passwordHash: await hashPassword(randomBytes(32).toString("base64url")),
  });
  if (!deleted) throw authenticationRequired();
}

export function toUserProfileDto(user: User): UserProfileDto {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  };
}
