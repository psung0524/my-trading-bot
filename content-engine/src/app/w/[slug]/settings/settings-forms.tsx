"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { addMemberAction, deleteMyAccountAction, removeMemberAction, updateWorkspaceAction } from "@/server/actions/workspace";
import { saveScoreWeightsAction } from "@/server/actions/recommendations";

export function WorkspaceSettingsForm({ slug, name, disabled }: { slug: string; name: string; disabled: boolean }) {
  const [value, setValue] = useState(name);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await updateWorkspaceAction(slug, { name: value });
          if (res.ok) toast.success("저장했습니다");
          else toast.error(res.error);
        });
      }}
    >
      <div className="flex-1">
        <Label htmlFor="ws-name">이름</Label>
        <Input id="ws-name" value={value} onChange={(e) => setValue(e.target.value)} disabled={disabled} className="mt-1" />
      </div>
      <Button type="submit" disabled={disabled || pending}>
        저장
      </Button>
    </form>
  );
}

export function MemberManager({
  slug,
  currentUserId,
  canManage,
  members,
}: {
  slug: string;
  currentUserId: string;
  canManage: boolean;
  members: { userId: string; name: string; email: string; role: string }[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("EDITOR");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4">
      <ul className="divide-y rounded-md border text-sm">
        {members.map((m) => (
          <li key={m.userId} className="flex items-center justify-between gap-2 p-2">
            <div className="min-w-0">
              <p className="truncate font-medium">{m.name || m.email}</p>
              <p className="truncate text-xs text-muted-foreground">{m.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs">{m.role}</span>
              {canManage && m.role !== "OWNER" && m.userId !== currentUserId && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const res = await removeMemberAction(slug, m.userId);
                      if (res.ok) {
                        toast.success("제거했습니다");
                        router.refresh();
                      } else toast.error(res.error);
                    })
                  }
                >
                  제거
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {canManage && (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await addMemberAction(slug, { email, role });
              if (res.ok) {
                toast.success("멤버를 추가했습니다");
                setEmail("");
                router.refresh();
              } else toast.error(res.error);
            });
          }}
        >
          <Input
            type="email"
            placeholder="가입된 사용자 이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="멤버 이메일"
            required
          />
          <select
            className="h-9 rounded-md border bg-transparent px-2 text-sm"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            aria-label="역할"
          >
            <option value="ADMIN">ADMIN</option>
            <option value="EDITOR">EDITOR</option>
            <option value="VIEWER">VIEWER</option>
          </select>
          <Button type="submit" disabled={pending}>
            추가
          </Button>
        </form>
      )}
    </div>
  );
}

export function DangerZone() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" disabled={pending}>
          내 계정 삭제
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>정말 삭제할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            소유한 워크스페이스는 보관 처리되고 계정 정보는 익명화됩니다. 이 작업은 되돌릴 수 없습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              start(async () => {
                const res = await deleteMyAccountAction();
                if (res.ok) {
                  toast.success("삭제되었습니다");
                  router.push("/api/auth/signout");
                } else toast.error(res.error);
              })
            }
          >
            삭제
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ScoreWeightsForm({ slug, weights, disabled }: { slug: string; weights: { click: number; signup: number; activation: number; return: number }; disabled: boolean }) {
  const [w, setW] = useState(weights);
  const [pending, start] = useTransition();
  const fields: { k: keyof typeof w; label: string }[] = [{ k: "click", label: "클릭" }, { k: "signup", label: "가입 전환" }, { k: "activation", label: "핵심 기능 사용" }, { k: "return", label: "재방문" }];
  return (
    <form
      className="grid gap-3 sm:grid-cols-5 sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await saveScoreWeightsAction(slug, w);
          if (res.ok) toast.success("가중치를 저장했습니다");
          else toast.error(res.error);
        });
      }}
    >
      {fields.map((f) => (
        <div key={f.k}>
          <Label htmlFor={`w-${f.k}`}>{f.label}</Label>
          <Input id={`w-${f.k}`} type="number" step="0.05" min="0" max="1" value={w[f.k]} onChange={(e) => setW({ ...w, [f.k]: Number(e.target.value) })} disabled={disabled} className="mt-1" />
        </div>
      ))}
      <Button type="submit" disabled={disabled || pending}>저장</Button>
    </form>
  );
}
