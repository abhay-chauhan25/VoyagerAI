
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "ai_usage": {
                  Row: {
                    "calls": number,"day": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "calls"?: number,"day"?: string,"user_id": string
                  }
                  Update: {
                    "calls"?: number,"day"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_usage_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"cities": {
                  Row: {
                    "ascii_name": string,"country_code": string,"geoname_id": number,"latitude": number,"longitude": number,"name": string,"population": number,"region": string | null,"timezone": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "ascii_name": string,"country_code": string,"geoname_id": number,"latitude": number,"longitude": number,"name": string,"population"?: number,"region"?: string | null,"timezone"?: string | null
                  }
                  Update: {
                    "ascii_name"?: string,"country_code"?: string,"geoname_id"?: number,"latitude"?: number,"longitude"?: number,"name"?: string,"population"?: number,"region"?: string | null,"timezone"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"dna_reactions": {
                  Row: {
                    "created_at": string,"reaction": Database["public"]['Enums']["dna_reaction"],"scene_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"reaction": Database["public"]['Enums']["dna_reaction"],"scene_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"reaction"?: Database["public"]['Enums']["dna_reaction"],"scene_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "dna_reactions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"drift_decks": {
                  Row: {
                    "built_on": string,"cards": NonNullable<Json>,"created_at": string,"deck_key": string,"source": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "built_on"?: string,"cards": NonNullable<Json>,"created_at"?: string,"deck_key": string,"source": string,"user_id"?: string
                  }
                  Update: {
                    "built_on"?: string,"cards"?: NonNullable<Json>,"created_at"?: string,"deck_key"?: string,"source"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "drift_decks_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string,"handle": string | null,"home_city": string | null,"id": string,"is_public": boolean,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name": string,"handle"?: string | null,"home_city"?: string | null,"id": string,"is_public"?: boolean,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"handle"?: string | null,"home_city"?: string | null,"id"?: string,"is_public"?: boolean,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"proposals": {
                  Row: {
                    "changes": NonNullable<Json>,"created_at": string,"decided_at": string | null,"id": string,"request": string,"source": string,"status": Database["public"]['Enums']["proposal_status"],"summary": string,"trip_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "changes": NonNullable<Json>,"created_at"?: string,"decided_at"?: string | null,"id"?: string,"request": string,"source": string,"status"?: Database["public"]['Enums']["proposal_status"],"summary": string,"trip_id": string,"user_id"?: string
                  }
                  Update: {
                    "changes"?: NonNullable<Json>,"created_at"?: string,"decided_at"?: string | null,"id"?: string,"request"?: string,"source"?: string,"status"?: Database["public"]['Enums']["proposal_status"],"summary"?: string,"trip_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "proposals_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "proposals_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"saves": {
                  Row: {
                    "city_id": number,"created_at": string,"id": string,"kind": Database["public"]['Enums']["save_kind"],"snapshot": NonNullable<Json>,"source_key": string,"user_id": string,"verdict": Database["public"]['Enums']["dna_reaction"]
                  }
                  ComputedFields: never
                  Insert: {
                    "city_id": number,"created_at"?: string,"id"?: string,"kind": Database["public"]['Enums']["save_kind"],"snapshot": NonNullable<Json>,"source_key": string,"user_id"?: string,"verdict": Database["public"]['Enums']["dna_reaction"]
                  }
                  Update: {
                    "city_id"?: number,"created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["save_kind"],"snapshot"?: NonNullable<Json>,"source_key"?: string,"user_id"?: string,"verdict"?: Database["public"]['Enums']["dna_reaction"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "saves_city_id_fkey"
      columns: ["city_id"]
isOneToOne: false
      referencedRelation: "cities"
      referencedColumns: ["geoname_id"]
    },{
      foreignKeyName: "saves_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"travel_dna": {
                  Row: {
                    "budget": Database["public"]['Enums']["budget_band"],"companions": (string)[],"completed_at": string,"interest_weights": NonNullable<Json>,"pace": Database["public"]['Enums']["travel_pace"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "budget": Database["public"]['Enums']["budget_band"],"companions"?: (string)[],"completed_at"?: string,"interest_weights"?: NonNullable<Json>,"pace": Database["public"]['Enums']["travel_pace"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "budget"?: Database["public"]['Enums']["budget_band"],"companions"?: (string)[],"completed_at"?: string,"interest_weights"?: NonNullable<Json>,"pace"?: Database["public"]['Enums']["travel_pace"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "travel_dna_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"trip_days": {
                  Row: {
                    "day_index": number,"mode": Database["public"]['Enums']["travel_mode"],"route": Json | null,"title": string | null,"title_source": string | null,"trip_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "day_index": number,"mode"?: Database["public"]['Enums']["travel_mode"],"route"?: Json | null,"title"?: string | null,"title_source"?: string | null,"trip_id": string,"user_id"?: string
                  }
                  Update: {
                    "day_index"?: number,"mode"?: Database["public"]['Enums']["travel_mode"],"route"?: Json | null,"title"?: string | null,"title_source"?: string | null,"trip_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "trip_days_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trip_days_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"trip_stops": {
                  Row: {
                    "cost_amount": number | null,"created_at": string,"day_index": number,"dwell_minutes": number,"id": string,"place": NonNullable<Json>,"position": number,"price_level": number,"source_key": string,"trip_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cost_amount"?: number | null,"created_at"?: string,"day_index": number,"dwell_minutes": number,"id"?: string,"place": NonNullable<Json>,"position": number,"price_level": number,"source_key": string,"trip_id": string,"user_id"?: string
                  }
                  Update: {
                    "cost_amount"?: number | null,"created_at"?: string,"day_index"?: number,"dwell_minutes"?: number,"id"?: string,"place"?: NonNullable<Json>,"position"?: number,"price_level"?: number,"source_key"?: string,"trip_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "trip_stops_trip_id_day_index_fkey"
      columns: ["trip_id","day_index"]
isOneToOne: false
      referencedRelation: "trip_days"
      referencedColumns: ["trip_id","day_index"]
    },{
      foreignKeyName: "trip_stops_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trip_stops_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"trips": {
                  Row: {
                    "budget": Database["public"]['Enums']["budget_band"],"city_id": number,"created_at": string,"currency": string,"day_count": number,"id": string,"pace": Database["public"]['Enums']["travel_pace"],"start_date": string,"title": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "budget": Database["public"]['Enums']["budget_band"],"city_id": number,"created_at"?: string,"currency": string,"day_count": number,"id"?: string,"pace": Database["public"]['Enums']["travel_pace"],"start_date": string,"title": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "budget"?: Database["public"]['Enums']["budget_band"],"city_id"?: number,"created_at"?: string,"currency"?: string,"day_count"?: number,"id"?: string,"pace"?: Database["public"]['Enums']["travel_pace"],"start_date"?: string,"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "trips_city_id_fkey"
      columns: ["city_id"]
isOneToOne: false
      referencedRelation: "cities"
      referencedColumns: ["geoname_id"]
    },{
      foreignKeyName: "trips_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"visits": {
                  Row: {
                    "city_id": number | null,"country_code": string,"created_at": string,"id": string,"user_id": string,"visited_year": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "city_id"?: number | null,"country_code": string,"created_at"?: string,"id"?: string,"user_id"?: string,"visited_year"?: number | null
                  }
                  Update: {
                    "city_id"?: number | null,"country_code"?: string,"created_at"?: string,"id"?: string,"user_id"?: string,"visited_year"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "visits_city_id_fkey"
      columns: ["city_id"]
isOneToOne: false
      referencedRelation: "cities"
      referencedColumns: ["geoname_id"]
    },{
      foreignKeyName: "visits_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "arrange_trip":
{ Args: { "p_add"?: Json,"p_layout": Json,"p_remove"?: (string)[],"p_trip": string }; Returns: undefined
                           },
"consume_ai_quota":
{ Args: { "daily_limit": number }; Returns: boolean
                           },
"create_trip":
{ Args: { "p_days": Json,"p_stops": Json,"p_trip": Json }; Returns: string
                           },
"owns_trip":
{ Args: { "p_trip": string }; Returns: boolean
                           },
"profile_is_public":
{ Args: { "profile_id": string }; Returns: boolean
                           },
"search_cities":
{ Args: { "max_results"?: number,"query": string }; Returns: {
              "ascii_name": string,
"country_code": string,
"geoname_id": number,
"latitude": number,
"longitude": number,
"name": string,
"population": number,
"region": string | null,
"timezone": string | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "cities"
        isOneToOne: false
        isSetofReturn: true
      } }
          }
          Enums: {
            "budget_band": "shoestring"|"comfortable"|"splurge","dna_reaction": "pass"|"love"|"more","proposal_status": "pending"|"applied"|"dismissed","save_kind": "destination"|"activity","travel_mode": "walking"|"driving","travel_pace": "slow"|"balanced"|"full"
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
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "budget_band": ["shoestring", "comfortable", "splurge"],"dna_reaction": ["pass", "love", "more"],"proposal_status": ["pending", "applied", "dismissed"],"save_kind": ["destination", "activity"],"travel_mode": ["walking", "driving"],"travel_pace": ["slow", "balanced", "full"]
          }
        }
} as const
