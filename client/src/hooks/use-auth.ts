import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string | null;
}

export function useCurrentUser() {
  return useQuery<{ user: AuthUser | null }>({
    queryKey: ["/api/auth/me"],
  });
}

export function useIsAuthenticated() {
  const { data, isLoading, isFetched } = useCurrentUser();
  return {
    user: data?.user ?? null,
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
