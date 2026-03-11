/**
 * Shared TypeScript types for API responses.
 * These match the Pydantic models in backend/app/models/.
 */

// ═══════════════════════════════════════════════════════════════
//  USER
// ═══════════════════════════════════════════════════════════════

export type UserRole = 'SUPER_ADMIN' | 'BCH_VANPHONG' | 'BCH_CUALO' | 'BCH_BENTHUY' | 'MEMBER';
export type Department = 'VAN_PHONG_CANG' | 'CUA_LO' | 'BEN_THUY';
export type UserStatus = 'ACTIVE' | 'PENDING' | 'DISABLED';

export interface User {
    id: string;
    username: string;
    fullName: string;
    unionId: string;
    role: UserRole;
    department: Department;
    avatar?: string;
    status: UserStatus;
    pushToken?: string;
}

export interface LoginResponse {
    token: string;
    refreshToken: string;
    user: User;
}

// ═══════════════════════════════════════════════════════════════
//  POSTS
// ═══════════════════════════════════════════════════════════════

export interface Post {
    id: string;
    title: string;
    content: string;
    summary: string;
    category: string;
    image?: string;
    authorId: string;
    authorName: string;
    authorDepartment: string;
    targetDepartments: string[];
    likes: string[];
    commentCount: number;
    createdAt: string;
    updatedAt: string;
}

export interface Comment {
    id: string;
    postId: string;
    userId: string;
    userName: string;
    userAvatar?: string;
    content: string;
    createdAt: string;
}

// ═══════════════════════════════════════════════════════════════
//  ACTIVITIES
// ═══════════════════════════════════════════════════════════════

export type ActivityStatus = 'upcoming' | 'ongoing' | 'completed' | 'cancelled';

export interface Activity {
    id: string;
    title: string;
    description: string;
    location: string;
    time: string;
    endTime?: string;
    image?: string;
    targetDepartments: string[];
    registeredUsers: string[];
    attendedUsers: string[];
    status: ActivityStatus;
    authorId: string;
    authorName: string;
    createdAt: string;
}

// ═══════════════════════════════════════════════════════════════
//  SURVEYS
// ═══════════════════════════════════════════════════════════════

export type QuestionType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'STAR_RATING' | 'OPEN_TEXT';
export type SurveyStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED';

export interface SurveyQuestion {
    content: string;
    type: QuestionType;
    options: string[];
    isRequired: boolean;
}

export interface Survey {
    id: string;
    title: string;
    description?: string;
    questions: SurveyQuestion[];
    isAnonymous: boolean;
    deadline?: string;
    targetDepartments: string[];
    status: SurveyStatus;
    responseCount: number;
    authorId: string;
    authorName: string;
    createdAt: string;
}

// ═══════════════════════════════════════════════════════════════
//  ELEARNING
// ═══════════════════════════════════════════════════════════════

export interface Course {
    id: string;
    title: string;
    description: string;
    content: string;
    targetDepartments: string[];
    enrollmentCount: number;
    quizCount: number;
    authorId: string;
    authorName: string;
    createdAt: string;
}

export interface Quiz {
    id: string;
    courseId: string;
    title: string;
    questions: QuizQuestion[];
    timeLimit: number;
    createdAt: string;
}

export interface QuizQuestion {
    content: string;
    type: 'SINGLE' | 'MULTIPLE';
    options: string[];
    correctAnswer?: number; // Only visible to admin
}

// ═══════════════════════════════════════════════════════════════
//  HONORS
// ═══════════════════════════════════════════════════════════════

export type CampaignStatus = 'ACTIVE' | 'CLOSED';
export type NominationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Campaign {
    id: string;
    title: string;
    description: string;
    targetDepartments: string[];
    status: CampaignStatus;
    nominationCount: number;
    createdAt: string;
}

export interface Nomination {
    id: string;
    campaignId: string;
    nomineeName: string;
    nomineeUnionId: string;
    reason: string;
    status: NominationStatus;
    reviewNote?: string;
    submittedBy: string;
    createdAt: string;
}

// ═══════════════════════════════════════════════════════════════
//  NOTIFICATIONS & FEEDBACK
// ═══════════════════════════════════════════════════════════════

export interface Notification {
    id: string;
    userId: string;
    title: string;
    body: string;
    type: string;
    data?: Record<string, string>;
    read: boolean;
    createdAt: string;
}

export interface Feedback {
    id: string;
    senderId: string;
    senderName: string;
    content: string;
    category: string;
    targetRecipients: string[];
    replies: FeedbackReply[];
    createdAt: string;
}

export interface FeedbackReply {
    responderId: string;
    responderName: string;
    content: string;
    createdAt: string;
}

// ═══════════════════════════════════════════════════════════════
//  DOCUMENTS
// ═══════════════════════════════════════════════════════════════

export interface Document {
    id: string;
    title: string;
    category: string;
    fileUrl: string;
    fileType: string;
    targetDepartments: string[];
    authorId: string;
    authorName: string;
    createdAt: string;
}

// ═══════════════════════════════════════════════════════════════
//  UNION MEMBERS
// ═══════════════════════════════════════════════════════════════

export interface UnionMember {
    id: string;
    fullName: string;
    unionId: string;
    department: string;
    position?: string;
    phone?: string;
    email?: string;
    gender?: string;
    dateOfBirth?: string;
    joinDate?: string;
    familyCircumstance?: string;
    personalCircumstance?: string;
}

// ═══════════════════════════════════════════════════════════════
//  API HELPERS
// ═══════════════════════════════════════════════════════════════

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
}

export interface ApiResponse<T = void> {
    status: 'success' | 'error';
    message: string;
    data?: T;
}

export interface WebSocketMessage {
    type: string;
    title?: string;
    body?: string;
    data?: Record<string, string>;
}
