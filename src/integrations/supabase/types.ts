export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      banners: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          image_url: string
          is_active: boolean
          link_type: string
          link_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url: string
          is_active?: boolean
          link_type?: string
          link_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string
          is_active?: boolean
          link_type?: string
          link_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          quiz_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          quiz_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          quiz_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_seasons: {
        Row: {
          created_at: string
          end_date: string
          id: string
          is_active: boolean
          name: string
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          is_active?: boolean
          name: string
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          is_active?: boolean
          name?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      live_quiz_answers: {
        Row: {
          answer_index: number
          answered_at: string
          id: string
          is_correct: boolean
          live_quiz_id: string
          question_index: number
          time_ms: number
          user_id: string
        }
        Insert: {
          answer_index: number
          answered_at?: string
          id?: string
          is_correct: boolean
          live_quiz_id: string
          question_index: number
          time_ms: number
          user_id: string
        }
        Update: {
          answer_index?: number
          answered_at?: string
          id?: string
          is_correct?: boolean
          live_quiz_id?: string
          question_index?: number
          time_ms?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_quiz_answers_live_quiz_id_fkey"
            columns: ["live_quiz_id"]
            isOneToOne: false
            referencedRelation: "live_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      live_quiz_participants: {
        Row: {
          correct_answers: number
          id: string
          joined_at: string
          live_quiz_id: string
          score: number
          total_time_ms: number
          user_id: string
        }
        Insert: {
          correct_answers?: number
          id?: string
          joined_at?: string
          live_quiz_id: string
          score?: number
          total_time_ms?: number
          user_id: string
        }
        Update: {
          correct_answers?: number
          id?: string
          joined_at?: string
          live_quiz_id?: string
          score?: number
          total_time_ms?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_quiz_participants_live_quiz_id_fkey"
            columns: ["live_quiz_id"]
            isOneToOne: false
            referencedRelation: "live_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      live_quiz_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          live_quiz_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          live_quiz_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          live_quiz_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_quiz_reactions_live_quiz_id_fkey"
            columns: ["live_quiz_id"]
            isOneToOne: false
            referencedRelation: "live_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      live_quizzes: {
        Row: {
          created_at: string
          current_question: number
          finished_at: string | null
          host_user_id: string
          id: string
          is_paid: boolean
          max_participants: number | null
          price_stars: number | null
          quiz_id: string
          started_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          current_question?: number
          finished_at?: string | null
          host_user_id: string
          id?: string
          is_paid?: boolean
          max_participants?: number | null
          price_stars?: number | null
          quiz_id: string
          started_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          current_question?: number
          finished_at?: string | null
          host_user_id?: string
          id?: string
          is_paid?: boolean
          max_participants?: number | null
          price_stars?: number | null
          quiz_id?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_quizzes_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          first_name: string | null
          has_telegram_premium: boolean | null
          id: string
          last_name: string | null
          onboarding_completed: boolean
          telegram_id: number | null
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          first_name?: string | null
          has_telegram_premium?: boolean | null
          id: string
          last_name?: string | null
          onboarding_completed?: boolean
          telegram_id?: number | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          first_name?: string | null
          has_telegram_premium?: boolean | null
          id?: string
          last_name?: string | null
          onboarding_completed?: boolean
          telegram_id?: number | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      questions: {
        Row: {
          correct_answer: number
          created_at: string
          id: string
          image_url: string | null
          options: Json
          order_index: number
          question_text: string
          quiz_id: string
        }
        Insert: {
          correct_answer?: number
          created_at?: string
          id?: string
          image_url?: string | null
          options?: Json
          order_index?: number
          question_text: string
          quiz_id: string
        }
        Update: {
          correct_answer?: number
          created_at?: string
          id?: string
          image_url?: string | null
          options?: Json
          order_index?: number
          question_text?: string
          quiz_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_likes: {
        Row: {
          created_at: string
          id: string
          quiz_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          quiz_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          quiz_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_likes_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_ratings: {
        Row: {
          created_at: string
          id: string
          quiz_id: string
          rating: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          quiz_id: string
          rating: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          quiz_id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_ratings_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_results: {
        Row: {
          answers: Json | null
          completed_at: string
          id: string
          max_score: number
          percentile: number
          quiz_id: string
          score: number
          user_id: string
        }
        Insert: {
          answers?: Json | null
          completed_at?: string
          id?: string
          max_score?: number
          percentile?: number
          quiz_id: string
          score?: number
          user_id: string
        }
        Update: {
          answers?: Json | null
          completed_at?: string
          id?: string
          max_score?: number
          percentile?: number
          quiz_id?: string
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_results_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          duration_seconds: number
          id: string
          image_url: string | null
          is_published: boolean
          like_count: number
          participant_count: number
          question_count: number
          rating: number | null
          rating_count: number | null
          save_count: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          duration_seconds?: number
          id?: string
          image_url?: string | null
          is_published?: boolean
          like_count?: number
          participant_count?: number
          question_count?: number
          rating?: number | null
          rating_count?: number | null
          save_count?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          duration_seconds?: number
          id?: string
          image_url?: string | null
          is_published?: boolean
          like_count?: number
          participant_count?: number
          question_count?: number
          rating?: number | null
          rating_count?: number | null
          save_count?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_taken_quiz: {
        Args: { check_quiz_id: string; check_user_id: string }
        Returns: boolean
      }
      is_admin: { Args: { check_user_id: string }; Returns: boolean }
      is_quiz_owner: {
        Args: { check_quiz_id: string; check_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
