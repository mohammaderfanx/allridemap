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
      affiliate_conversions_attribution: {
        Row: {
          conversion_status: Database["public"]["Enums"]["conversion_status"]
          converted_at: string | null
          created_at: string
          estimated_payout_cents: number
          expires_at: string
          postback_payload: Json | null
          provider_id: string
          provider_reference: string | null
          signed_payload: string
          token_id: string
          used_at: string | null
        }
        Insert: {
          conversion_status?: Database["public"]["Enums"]["conversion_status"]
          converted_at?: string | null
          created_at?: string
          estimated_payout_cents?: number
          expires_at?: string
          postback_payload?: Json | null
          provider_id: string
          provider_reference?: string | null
          signed_payload: string
          token_id?: string
          used_at?: string | null
        }
        Update: {
          conversion_status?: Database["public"]["Enums"]["conversion_status"]
          converted_at?: string | null
          created_at?: string
          estimated_payout_cents?: number
          expires_at?: string
          postback_payload?: Json | null
          provider_id?: string
          provider_reference?: string | null
          signed_payload?: string
          token_id?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_conversions_attribution_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      community_mobility_reports: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          lat: number
          lng: number
          note: string | null
          report_type: Database["public"]["Enums"]["pulse_report_type"]
          upvotes_count: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          lat: number
          lng: number
          note?: string | null
          report_type: Database["public"]["Enums"]["pulse_report_type"]
          upvotes_count?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          lat?: number
          lng?: number
          note?: string | null
          report_type?: Database["public"]["Enums"]["pulse_report_type"]
          upvotes_count?: number
          user_id?: string | null
        }
        Relationships: []
      }
      curated_discovery_routes: {
        Row: {
          created_at: string
          description: string
          eco_score: number
          estimated_duration_mins: number
          id: string
          route_geojson: Json
          title: string
        }
        Insert: {
          created_at?: string
          description: string
          eco_score?: number
          estimated_duration_mins: number
          id?: string
          route_geojson: Json
          title: string
        }
        Update: {
          created_at?: string
          description?: string
          eco_score?: number
          estimated_duration_mins?: number
          id?: string
          route_geojson?: Json
          title?: string
        }
        Relationships: []
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
      intercity_corridor_routes: {
        Row: {
          corridor_code: string
          destination_hub_code: string
          id: string
          origin_hub_code: string
          provider_code: string
          realtime_reliability_score: number
          transport_mode: Database["public"]["Enums"]["intercity_mode"]
          updated_at: string
        }
        Insert: {
          corridor_code: string
          destination_hub_code: string
          id?: string
          origin_hub_code: string
          provider_code: string
          realtime_reliability_score?: number
          transport_mode: Database["public"]["Enums"]["intercity_mode"]
          updated_at?: string
        }
        Update: {
          corridor_code?: string
          destination_hub_code?: string
          id?: string
          origin_hub_code?: string
          provider_code?: string
          realtime_reliability_score?: number
          transport_mode?: Database["public"]["Enums"]["intercity_mode"]
          updated_at?: string
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
      user_gamification_profiles: {
        Row: {
          badges_unlocked: string[]
          trust_tier: string
          updated_at: string
          user_id: string
          xp_points: number
        }
        Insert: {
          badges_unlocked?: string[]
          trust_tier?: string
          updated_at?: string
          user_id: string
          xp_points?: number
        }
        Update: {
          badges_unlocked?: string[]
          trust_tier?: string
          updated_at?: string
          user_id?: string
          xp_points?: number
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
      conversion_status: "initiated" | "completed" | "cancelled"
      intercity_mode: "high_speed_rail" | "aviation" | "evtol" | "intercity_bus"
      provider_category: "Ride-Hailing" | "Micro-Mobility" | "Public-Transit"
      provider_status: "active" | "degraded" | "offline"
      pulse_report_type:
        | "scooter_damaged"
        | "station_elevator_broken"
        | "high_crowding"
        | "police_check"
        | "custom_shortcut"
        | "surge_pricing"
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
      conversion_status: ["initiated", "completed", "cancelled"],
      intercity_mode: ["high_speed_rail", "aviation", "evtol", "intercity_bus"],
      provider_category: ["Ride-Hailing", "Micro-Mobility", "Public-Transit"],
      provider_status: ["active", "degraded", "offline"],
      pulse_report_type: [
        "scooter_damaged",
        "station_elevator_broken",
        "high_crowding",
        "police_check",
        "custom_shortcut",
        "surge_pricing",
      ],
    },
  },
} as const
