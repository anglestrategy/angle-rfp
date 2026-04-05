import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string | null;
  emailVerified: boolean;
}

export interface AuthWorkspace {
  id: string;
  name: string;
  slug: string;
  role: string;
  onboardingStatus: string;
}

export interface AuthMeResponse {
  user: AuthUser | null;
  workspace: AuthWorkspace | null;
  onboarding: {
    status: string;
    calibrationState: "default" | "partial" | "full";
  } | null;
}

export function useCurrentUser() {
  return useQuery<AuthMeResponse>({
    queryKey: ["/api/auth/me"],
  });
}

export function useIsAuthenticated() {
  const { data, isLoading, isFetched } = useCurrentUser();
  return {
    user: data?.user ?? null,
    workspace: data?.workspace ?? null,
    onboarding: data?.onboarding ?? null,
    isLoading,
    isFetched,
    isAuthenticated: Boolean(data?.user),
  };
}

export function useSignOut() {
  return useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/sign-out");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/analyses"] });
    },
  });
}
