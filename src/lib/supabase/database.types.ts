
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
            "cities": {
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
            "budget_band": "shoestring"|"comfortable"|"splurge","dna_reaction": "pass"|"love"|"more","travel_pace": "slow"|"balanced"|"full"
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
            "budget_band": ["shoestring", "comfortable", "splurge"],"dna_reaction": ["pass", "love", "more"],"travel_pace": ["slow", "balanced", "full"]
          }
        }
} as const
