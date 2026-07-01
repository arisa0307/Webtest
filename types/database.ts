// Supabase のテーブル/RPC に対する型定義。
// supabase gen types での自動生成も可能だが、ここでは手書きで最小限に保つ。

export type Profile = {
  id: string;
  email: string | null;
  display_name: string | null;
  is_admin: boolean;
  is_approved: boolean;
  created_at: string;
};

export type Book = {
  id: string;
  subject: string;
  teacher: string | null;
  title: string | null;
  created_at: string;
};

export type Question = {
  id: string;
  book_id: string;
  question: string;
  choices: string | null;
  answer: string | null;
  explanation: string | null;
  image_urls: string[];
  has_graph: boolean;
  normalized_text: string;
  search_text: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AiUsageStatus = {
  monthly_count: number;
  monthly_limit: number;
};

type Insertable<T, Generated extends keyof T> = Omit<T, Generated> &
  Partial<Pick<T, Generated>>;

type NoRelationships = [];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Insertable<
          Profile,
          "created_at" | "is_admin" | "is_approved" | "display_name" | "email"
        >;
        Update: Partial<Profile>;
        Relationships: NoRelationships;
      };
      books: {
        Row: Book;
        Insert: Insertable<Book, "id" | "created_at" | "teacher" | "title">;
        Update: Partial<Book>;
        Relationships: NoRelationships;
      };
      questions: {
        Row: Question;
        // search_text は生成列なので Insert/Update から除外
        Insert: Insertable<
          Omit<Question, "search_text">,
          "id" | "created_at" | "updated_at" | "has_graph" | "image_urls"
        >;
        Update: Partial<Omit<Question, "search_text">>;
        Relationships: [
          {
            foreignKeyName: "questions_book_id_fkey";
            columns: ["book_id"];
            isOneToOne: false;
            referencedRelation: "books";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: {
      search_questions: {
        Args: { p_book_id: string; p_query: string };
        Returns: Question[];
      };
      duplicate_candidates: {
        Args: { p_book_id: string; p_text: string; p_limit?: number };
        Returns: Question[];
      };
      claim_ai_budget: {
        Args: { p_kind: string };
        Returns: boolean;
      };
      ai_usage_status: {
        Args: Record<string, never>;
        Returns: AiUsageStatus[];
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
  };
};
