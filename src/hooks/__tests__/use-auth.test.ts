import { renderHook, act } from "@testing-library/react";
import { vi, test, expect, beforeEach, describe } from "vitest";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

const mockPush = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  (useRouter as ReturnType<typeof vi.fn>).mockReturnValue({ push: mockPush });
  (getAnonWorkData as ReturnType<typeof vi.fn>).mockReturnValue(null);
  (getProjects as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (createProject as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "new-project-id" });
});

describe("useAuth - initial state", () => {
  test("isLoading starts as false", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading).toBe(false);
  });

  test("returns signIn, signUp, and isLoading", () => {
    const { result } = renderHook(() => useAuth());
    expect(typeof result.current.signIn).toBe("function");
    expect(typeof result.current.signUp).toBe("function");
    expect(typeof result.current.isLoading).toBe("boolean");
  });
});

describe("useAuth - signIn", () => {
  test("calls signInAction with the provided credentials", async () => {
    (signInAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: false, error: "Invalid" });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@example.com", "mypassword");
    });

    expect(signInAction).toHaveBeenCalledWith("user@example.com", "mypassword");
    expect(signInAction).toHaveBeenCalledTimes(1);
  });

  test("returns the result from signInAction", async () => {
    const authResult = { success: true };
    (signInAction as ReturnType<typeof vi.fn>).mockResolvedValue(authResult);

    const { result } = renderHook(() => useAuth());

    let returnValue: any;
    await act(async () => {
      returnValue = await result.current.signIn("user@example.com", "password123");
    });

    expect(returnValue).toEqual(authResult);
  });

  describe("on success - post sign-in navigation", () => {
    test("navigates to the user's most recent project when there is no anon work", async () => {
      (signInAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
      (getProjects as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "project-1" },
        { id: "project-2" },
      ]);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(mockPush).toHaveBeenCalledWith("/project-1");
      expect(createProject).not.toHaveBeenCalled();
    });

    test("creates a new blank project and navigates to it when user has no projects", async () => {
      (signInAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
      (getProjects as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (createProject as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "fresh-project-id" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          name: expect.stringMatching(/^New Design #\d+$/),
          messages: [],
          data: {},
        })
      );
      expect(mockPush).toHaveBeenCalledWith("/fresh-project-id");
    });

    test("saves anon work as a project, clears it, and navigates to it", async () => {
      const anonMessages = [{ role: "user", content: "make a button" }];
      const anonFileSystem = { "/App.jsx": { content: "<button />" } };
      (signInAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
      (getAnonWorkData as ReturnType<typeof vi.fn>).mockReturnValue({
        messages: anonMessages,
        fileSystemData: anonFileSystem,
      });
      (createProject as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "anon-project-id" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(createProject).toHaveBeenCalledWith({
        name: expect.stringMatching(/^Design from /),
        messages: anonMessages,
        data: anonFileSystem,
      });
      expect(clearAnonWork).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith("/anon-project-id");
    });

    test("skips fetching projects when anon work is present", async () => {
      (signInAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
      (getAnonWorkData as ReturnType<typeof vi.fn>).mockReturnValue({
        messages: [{ role: "user", content: "hello" }],
        fileSystemData: {},
      });
      (createProject as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "anon-project-id" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(getProjects).not.toHaveBeenCalled();
    });

    test("falls through to project lookup when anon work has no messages", async () => {
      (signInAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
      (getAnonWorkData as ReturnType<typeof vi.fn>).mockReturnValue({
        messages: [],
        fileSystemData: {},
      });
      (getProjects as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: "existing-project" }]);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(createProject).not.toHaveBeenCalled();
      expect(clearAnonWork).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/existing-project");
    });
  });

  describe("on failure", () => {
    test("does not navigate when signInAction returns success: false", async () => {
      (signInAction as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: "Invalid credentials",
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "wrongpassword");
      });

      expect(mockPush).not.toHaveBeenCalled();
      expect(getProjects).not.toHaveBeenCalled();
      expect(createProject).not.toHaveBeenCalled();
    });

    test("returns the failure result from signInAction", async () => {
      const errorResult = { success: false, error: "Invalid credentials" };
      (signInAction as ReturnType<typeof vi.fn>).mockResolvedValue(errorResult);

      const { result } = renderHook(() => useAuth());

      let returnValue: any;
      await act(async () => {
        returnValue = await result.current.signIn("user@example.com", "wrong");
      });

      expect(returnValue).toEqual(errorResult);
    });

    test("propagates thrown errors from signInAction", async () => {
      (signInAction as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await expect(
          result.current.signIn("user@example.com", "password123")
        ).rejects.toThrow("Network error");
      });
    });
  });

  describe("isLoading state", () => {
    test("is true while the request is in flight and false after it resolves", async () => {
      let resolveAction: (value: any) => void;
      (signInAction as ReturnType<typeof vi.fn>).mockReturnValue(
        new Promise((resolve) => {
          resolveAction = resolve;
        })
      );

      const { result } = renderHook(() => useAuth());

      let callPromise: Promise<any>;
      act(() => {
        callPromise = result.current.signIn("user@example.com", "password123");
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveAction!({ success: false });
        await callPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("resets to false after a successful sign-in completes", async () => {
      (signInAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("resets to false even when signInAction throws", async () => {
      (signInAction as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123").catch(() => {});
      });

      expect(result.current.isLoading).toBe(false);
    });
  });
});

describe("useAuth - signUp", () => {
  test("calls signUpAction with the provided credentials", async () => {
    (signUpAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: false, error: "Invalid" });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("newuser@example.com", "securepass");
    });

    expect(signUpAction).toHaveBeenCalledWith("newuser@example.com", "securepass");
    expect(signUpAction).toHaveBeenCalledTimes(1);
  });

  test("returns the result from signUpAction", async () => {
    const authResult = { success: true };
    (signUpAction as ReturnType<typeof vi.fn>).mockResolvedValue(authResult);

    const { result } = renderHook(() => useAuth());

    let returnValue: any;
    await act(async () => {
      returnValue = await result.current.signUp("newuser@example.com", "securepass");
    });

    expect(returnValue).toEqual(authResult);
  });

  test("navigates to the first project on successful sign-up", async () => {
    (signUpAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
    (getProjects as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: "my-project" }]);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("newuser@example.com", "securepass");
    });

    expect(mockPush).toHaveBeenCalledWith("/my-project");
  });

  test("saves anon work as a project and navigates to it on successful sign-up", async () => {
    const anonMessages = [{ role: "user", content: "build a form" }];
    const anonFileSystem = { "/App.jsx": { content: "<form />" } };
    (signUpAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
    (getAnonWorkData as ReturnType<typeof vi.fn>).mockReturnValue({
      messages: anonMessages,
      fileSystemData: anonFileSystem,
    });
    (createProject as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "saved-anon-id" });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("newuser@example.com", "securepass");
    });

    expect(createProject).toHaveBeenCalledWith({
      name: expect.stringMatching(/^Design from /),
      messages: anonMessages,
      data: anonFileSystem,
    });
    expect(clearAnonWork).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/saved-anon-id");
  });

  test("does not navigate when signUpAction returns success: false", async () => {
    (signUpAction as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      error: "Email already registered",
    });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("existing@example.com", "password123");
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  test("propagates thrown errors from signUpAction", async () => {
    (signUpAction as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Server error"));

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await expect(
        result.current.signUp("user@example.com", "password123")
      ).rejects.toThrow("Server error");
    });
  });

  test("is true while the request is in flight and false after it resolves", async () => {
    let resolveAction: (value: any) => void;
    (signUpAction as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise((resolve) => {
        resolveAction = resolve;
      })
    );

    const { result } = renderHook(() => useAuth());

    let callPromise: Promise<any>;
    act(() => {
      callPromise = result.current.signUp("newuser@example.com", "password123");
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveAction!({ success: false });
      await callPromise;
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("resets isLoading to false even when signUpAction throws", async () => {
    (signUpAction as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Server error"));

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("user@example.com", "password123").catch(() => {});
    });

    expect(result.current.isLoading).toBe(false);
  });
});
