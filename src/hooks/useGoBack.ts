import { useRouter } from "next/navigation";

const useGoBack = () => {
  const router = useRouter();

  const goBack = () => {
    if (window.history.length > 1) {
      router.back(); // Navigate to the previous route
    } else {
      router.push("/dashboard"); // Fall back to the workspace home when no history
    }
  };

  return goBack;
};

export default useGoBack;
