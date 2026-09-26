
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "audit_log": {
                  Row: {
                    "action": string,"actor": string,"created_at": string,"detail": NonNullable<Json>,"event_id": string | null,"id": number,"studio_id": string | null
                  }
                  Insert: {
                    "action": string,"actor": string,"created_at"?: string,"detail"?: NonNullable<Json>,"event_id"?: string | null,"id"?: never,"studio_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor"?: string,"created_at"?: string,"detail"?: NonNullable<Json>,"event_id"?: string | null,"id"?: never,"studio_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    }
                  ]
                },"clusters": {
                  Row: {
                    "centroid": string,"created_at": string,"engine_version": string,"event_id": string,"id": string,"representative_face_id": string | null,"size": number
                  }
                  Insert: {
                    "centroid": string,"created_at"?: string,"engine_version": string,"event_id": string,"id"?: string,"representative_face_id"?: string | null,"size": number
                  }
                  Update: {
                    "centroid"?: string,"created_at"?: string,"engine_version"?: string,"event_id"?: string,"id"?: string,"representative_face_id"?: string | null,"size"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "clusters_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clusters_representative_fk"
      columns: ["representative_face_id"]
isOneToOne: false
      referencedRelation: "faces"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "allow_download": boolean,"cover_key": string | null,"created_at": string,"event_date": string | null,"expires_at": string | null,"face_count": number,"failed_count": number,"id": string,"name": string,"people_count": number,"photo_count": number,"pin_hash": string | null,"processed_count": number,"show_all_gallery": boolean,"slug": string,"status": string,"studio_id": string,"updated_at": string,"visibility": string,"watermark": boolean
                  }
                  Insert: {
                    "allow_download"?: boolean,"cover_key"?: string | null,"created_at"?: string,"event_date"?: string | null,"expires_at"?: string | null,"face_count"?: number,"failed_count"?: number,"id"?: string,"name": string,"people_count"?: number,"photo_count"?: number,"pin_hash"?: string | null,"processed_count"?: number,"show_all_gallery"?: boolean,"slug": string,"status"?: string,"studio_id": string,"updated_at"?: string,"visibility"?: string,"watermark"?: boolean
                  }
                  Update: {
                    "allow_download"?: boolean,"cover_key"?: string | null,"created_at"?: string,"event_date"?: string | null,"expires_at"?: string | null,"face_count"?: number,"failed_count"?: number,"id"?: string,"name"?: string,"people_count"?: number,"photo_count"?: number,"pin_hash"?: string | null,"processed_count"?: number,"show_all_gallery"?: boolean,"slug"?: string,"status"?: string,"studio_id"?: string,"updated_at"?: string,"visibility"?: string,"watermark"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    }
                  ]
                },"faces": {
                  Row: {
                    "bbox": (number)[],"blur_score": number,"cluster_id": string | null,"created_at": string,"det_score": number,"embedding": string | null,"engine_version": string,"event_id": string,"id": string,"landmarks": (number)[],"photo_id": string,"quality": string
                  }
                  Insert: {
                    "bbox": (number)[],"blur_score": number,"cluster_id"?: string | null,"created_at"?: string,"det_score": number,"embedding"?: string | null,"engine_version": string,"event_id": string,"id"?: string,"landmarks": (number)[],"photo_id": string,"quality": string
                  }
                  Update: {
                    "bbox"?: (number)[],"blur_score"?: number,"cluster_id"?: string | null,"created_at"?: string,"det_score"?: number,"embedding"?: string | null,"engine_version"?: string,"event_id"?: string,"id"?: string,"landmarks"?: (number)[],"photo_id"?: string,"quality"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "faces_cluster_id_fkey"
      columns: ["cluster_id"]
isOneToOne: false
      referencedRelation: "clusters"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "faces_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "faces_photo_id_fkey"
      columns: ["photo_id"]
isOneToOne: false
      referencedRelation: "photos"
      referencedColumns: ["id"]
    }
                  ]
                },"guest_sessions": {
                  Row: {
                    "consent_at": string,"consent_version": string,"created_at": string,"event_id": string,"id": string,"ip_hash": string | null,"matched_count": number | null,"matched_photo_ids": (string)[] | null,"matches_expire_at": string | null,"searched_at": string | null
                  }
                  Insert: {
                    "consent_at": string,"consent_version": string,"created_at"?: string,"event_id": string,"id"?: string,"ip_hash"?: string | null,"matched_count"?: number | null,"matched_photo_ids"?: (string)[] | null,"matches_expire_at"?: string | null,"searched_at"?: string | null
                  }
                  Update: {
                    "consent_at"?: string,"consent_version"?: string,"created_at"?: string,"event_id"?: string,"id"?: string,"ip_hash"?: string | null,"matched_count"?: number | null,"matched_photo_ids"?: (string)[] | null,"matches_expire_at"?: string | null,"searched_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "guest_sessions_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"jobs": {
                  Row: {
                    "attempts": number,"created_at": string,"dedupe_key": string | null,"finished_at": string | null,"id": number,"last_error": string | null,"locked_at": string | null,"locked_by": string | null,"max_attempts": number,"payload": NonNullable<Json>,"run_after": string,"status": string,"type": string
                  }
                  Insert: {
                    "attempts"?: number,"created_at"?: string,"dedupe_key"?: string | null,"finished_at"?: string | null,"id"?: never,"last_error"?: string | null,"locked_at"?: string | null,"locked_by"?: string | null,"max_attempts"?: number,"payload"?: NonNullable<Json>,"run_after"?: string,"status"?: string,"type": string
                  }
                  Update: {
                    "attempts"?: number,"created_at"?: string,"dedupe_key"?: string | null,"finished_at"?: string | null,"id"?: never,"last_error"?: string | null,"locked_at"?: string | null,"locked_by"?: string | null,"max_attempts"?: number,"payload"?: NonNullable<Json>,"run_after"?: string,"status"?: string,"type"?: string
                  }
                  Relationships: [
                    
                  ]
                },"photos": {
                  Row: {
                    "blurhash": string | null,"bytes": number,"content_type": string | null,"created_at": string,"error": string | null,"event_id": string,"face_count": number,"height": number | null,"id": string,"original_name": string | null,"processed_at": string | null,"r2_key_original": string,"r2_key_thumb": string | null,"r2_key_web": string | null,"r2_key_web_wm": string | null,"sha256": string,"status": string,"studio_id": string,"taken_at": string | null,"width": number | null
                  }
                  Insert: {
                    "blurhash"?: string | null,"bytes"?: number,"content_type"?: string | null,"created_at"?: string,"error"?: string | null,"event_id": string,"face_count"?: number,"height"?: number | null,"id"?: string,"original_name"?: string | null,"processed_at"?: string | null,"r2_key_original": string,"r2_key_thumb"?: string | null,"r2_key_web"?: string | null,"r2_key_web_wm"?: string | null,"sha256": string,"status"?: string,"studio_id": string,"taken_at"?: string | null,"width"?: number | null
                  }
                  Update: {
                    "blurhash"?: string | null,"bytes"?: number,"content_type"?: string | null,"created_at"?: string,"error"?: string | null,"event_id"?: string,"face_count"?: number,"height"?: number | null,"id"?: string,"original_name"?: string | null,"processed_at"?: string | null,"r2_key_original"?: string,"r2_key_thumb"?: string | null,"r2_key_web"?: string | null,"r2_key_web_wm"?: string | null,"sha256"?: string,"status"?: string,"studio_id"?: string,"taken_at"?: string | null,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "photos_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "photos_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    }
                  ]
                },"plans": {
                  Row: {
                    "active_events": number | null,"custom_branding": boolean,"id": Database["public"]['Enums']["plan_tier"],"name": string,"photos_per_month": number,"price_inr_monthly": number,"sort": number,"storage_gb": number
                  }
                  Insert: {
                    "active_events"?: number | null,"custom_branding": boolean,"id": Database["public"]['Enums']["plan_tier"],"name": string,"photos_per_month": number,"price_inr_monthly": number,"sort": number,"storage_gb": number
                  }
                  Update: {
                    "active_events"?: number | null,"custom_branding"?: boolean,"id"?: Database["public"]['Enums']["plan_tier"],"name"?: string,"photos_per_month"?: number,"price_inr_monthly"?: number,"sort"?: number,"storage_gb"?: number
                  }
                  Relationships: [
                    
                  ]
                },"privacy_requests": {
                  Row: {
                    "created_at": string,"email": string,"event_id": string | null,"event_slug": string | null,"id": string,"message": string | null,"resolved_at": string | null,"status": string
                  }
                  Insert: {
                    "created_at"?: string,"email": string,"event_id"?: string | null,"event_slug"?: string | null,"id"?: string,"message"?: string | null,"resolved_at"?: string | null,"status"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"event_id"?: string | null,"event_slug"?: string | null,"id"?: string,"message"?: string | null,"resolved_at"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "privacy_requests_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"rate_limits": {
                  Row: {
                    "hits": number,"key": string,"window_start": string
                  }
                  Insert: {
                    "hits"?: number,"key": string,"window_start": string
                  }
                  Update: {
                    "hits"?: number,"key"?: string,"window_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"studios": {
                  Row: {
                    "brand_color": string,"brand_logo_key": string | null,"created_at": string,"id": string,"name": string,"owner_id": string,"plan": Database["public"]['Enums']["plan_tier"],"plan_renews_at": string | null,"plan_status": string,"razorpay_customer_id": string | null,"razorpay_subscription_id": string | null,"updated_at": string
                  }
                  Insert: {
                    "brand_color"?: string,"brand_logo_key"?: string | null,"created_at"?: string,"id"?: string,"name": string,"owner_id": string,"plan"?: Database["public"]['Enums']["plan_tier"],"plan_renews_at"?: string | null,"plan_status"?: string,"razorpay_customer_id"?: string | null,"razorpay_subscription_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "brand_color"?: string,"brand_logo_key"?: string | null,"created_at"?: string,"id"?: string,"name"?: string,"owner_id"?: string,"plan"?: Database["public"]['Enums']["plan_tier"],"plan_renews_at"?: string | null,"plan_status"?: string,"razorpay_customer_id"?: string | null,"razorpay_subscription_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"usage": {
                  Row: {
                    "month": string,"photos_processed": number,"photos_uploaded": number,"studio_id": string
                  }
                  Insert: {
                    "month": string,"photos_processed"?: number,"photos_uploaded"?: number,"studio_id": string
                  }
                  Update: {
                    "month"?: string,"photos_processed"?: number,"photos_uploaded"?: number,"studio_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "usage_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "hit_rate_limit":
{ Args: { "p_key": string,"p_limit": number,"p_window_seconds": number }; Returns: boolean
                           },
"my_studio_ids":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"refresh_event_stats":
{ Args: { "p_event_id": string }; Returns: undefined
                           },
"register_photo":
{ Args: { "p_bytes": number,"p_content_type": string,"p_event_id": string,"p_key": string,"p_name": string,"p_sha256": string }; Returns: {
              "created": boolean,"photo_id": string
            }[]
                           },
"request_event_deletion":
{ Args: { "p_event_id": string,"p_reason": string }; Returns: undefined
                           },
"search_event_faces":
{ Args: { "p_cluster_threshold": number,"p_embedding": string,"p_engine_version": string,"p_event_id": string,"p_limit"?: number,"p_threshold": number }; Returns: {
              "photo_id": string,"score": number,"taken_at": string,"via_cluster": boolean
            }[]
                           },
"studio_storage_bytes":
{ Args: { "p_studio_id": string }; Returns: number
                           }
          }
          Enums: {
            "plan_tier": "trial"|"starter"|"pro"|"studio"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "plan_tier": ["trial", "starter", "pro", "studio"]
          }
        }
} as const

