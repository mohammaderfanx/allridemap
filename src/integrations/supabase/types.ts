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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      affiliate_conversions: {
        Row: {
          clicked_at: string
          destination_lat: number
          destination_lng: number
          estimated_fare_eur: number | null
          id: string
          origin_lat: number
          origin_lng: number
          provider_id: string
          user_id: string | null
        }
        Insert: {
          clicked_at?: string
          destination_lat: number
          destination_lng: number
          estimated_fare_eur?: number | null
          id?: string
          origin_lat: number
          origin_lng: number
          provider_id: string
          user_id?: string | null
        }
        Update: {
          clicked_at?: string
          destination_lat?: number
          destination_lng?: number
          estimated_fare_eur?: number | null
          id?: string
          origin_lat?: number
          origin_lng?: number
          provider_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_conversions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      gtfs_rt_service_alerts: {
        Row: {
          affected_lines: string[]
          agency_id: string
          delay_minutes: number
          description_text: string | null
          header_text: string
          id: string
          severity_level: Database["public"]["Enums"]["alert_severity"]
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          affected_lines?: string[]
          agency_id?: string
          delay_minutes?: number
          description_text?: string | null
          header_text: string
          id?: string
          severity_level?: Database["public"]["Enums"]["alert_severity"]
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          affected_lines?: string[]
          agency_id?: string
          delay_minutes?: number
          description_text?: string | null
          header_text?: string
          id?: string
          severity_level?: Database["public"]["Enums"]["alert_severity"]
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: []
      }
      provider_integrations: {
        Row: {
          affiliate_tag: string | null
          category: Database["public"]["Enums"]["provider_category"]
          deep_link_template: string | null
          id: string
          provider_name: string
          slug: string
          status: Database["public"]["Enums"]["provider_status"]
          web_fallback_url: string | null
        }
        Insert: {
          affiliate_tag?: string | null
          category: Database["public"]["Enums"]["provider_category"]
          deep_link_template?: string | null
          id?: string
          provider_name: string
          slug: string
          status?: Database["public"]["Enums"]["provider_status"]
          web_fallback_url?: string | null
        }
        Update: {
          affiliate_tag?: string | null
          category?: Database["public"]["Enums"]["provider_category"]
          deep_link_template?: string | null
          id?: string
          provider_name?: string
          slug?: string
          status?: Database["public"]["Enums"]["provider_status"]
          web_fallback_url?: string | null
        }
        Relationships: []
      }
      route_cache_snapshots: {
        Row: {
          cache_key: string
          created_at: string
          destination_geohash: string
          expires_at: string
          id: string
          options_json: Json
          origin_geohash: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          destination_geohash: string
          expires_at?: string
          id?: string
          options_json: Json
          origin_geohash: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          destination_geohash?: string
          expires_at?: string
          id?: string
          options_json?: Json
          origin_geohash?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      alert_severity: "info" | "warning" | "severe"
      provider_category: "Ride-Hailing" | "Micro-Mobility" | "Public-Transit"
      provider_status: "active" | "degraded" | "offline"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      alert_severity: ["info", "warning", "severe"],
      provider_category: ["Ride-Hailing", "Micro-Mobility", "Public-Transit"],
      provider_status: ["active", "degraded", "offline"],
    },
  },
} as const
