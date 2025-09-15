import { UserRepository } from './repository';
import { CreateUserData, UpdateUserData, User } from './types';


export class UserService {
    constructor(private userRepository: UserRepository) {}

    async getAllUsers(): Promise<User[]> {
        return this.userRepository.findAll();
    }

    async getUserById(id: number): Promise<User | null> {
        return this.userRepository.findById(id);
    }

    async getUserByEmail(email: string): Promise<User | null> {
        return this.userRepository.findByEmail(email);
    }

    async createUser(data: CreateUserData): Promise<User> {
        const existingUser = await this.userRepository.findByEmail(data.email);
        if (existingUser) {
        throw new Error('User already exists');
        }

        return this.userRepository.create(data);
    }

    async updateUser(id: number, data: UpdateUserData): Promise<User> {
        return this.userRepository.update(id, data);
    }

    async deleteUser(id: number): Promise<User> {
        return this.userRepository.delete(id);
    }
}