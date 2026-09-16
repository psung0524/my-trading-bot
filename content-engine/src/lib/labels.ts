export const CHANNEL_LABELS: Record<string, string> = {
  THREADS: "Threads",
  INSTAGRAM: "Instagram 카드뉴스",
  BLOG: "블로그",
  YOUTUBE_SHORTS: "YouTube Shorts",
};

export const STATUS_LABELS: Record<string, string> = {
  IDEA: "아이디어",
  GENERATING: "생성 중",
  DRAFT: "초안",
  NEEDS_REVIEW: "검토 필요",
  NEEDS_SOURCE: "출처 필요",
  APPROVED: "승인됨",
  SCHEDULED: "예약됨",
  PUBLISHING: "게시 중",
  PUBLISHED: "게시됨",
  FAILED: "실패",
  REJECTED: "거부됨",
  ARCHIVED: "보관됨",
};

export const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  APPROVED: "default",
  PUBLISHED: "default",
  SCHEDULED: "default",
  NEEDS_REVIEW: "secondary",
  DRAFT: "outline",
  GENERATING: "outline",
  NEEDS_SOURCE: "destructive",
  FAILED: "destructive",
  REJECTED: "destructive",
  ARCHIVED: "outline",
  IDEA: "outline",
  PUBLISHING: "secondary",
};

export const SOURCE_TYPE_LABELS: Record<string, string> = {
  PRODUCT_DATA: "제품 데이터",
  MANUAL_INPUT: "직접 입력",
  USER_QUESTION: "사용자 질문",
  TREND: "트렌드",
  FREQUENTLY_VIEWED: "자주 본 데이터",
  CALCULATION: "계산",
  FEATURE_UPDATE: "기능 업데이트",
  EDUCATIONAL: "교육",
  COMMUNITY_QUESTION: "커뮤니티 질문",
};

export const TOPIC_STATUS_LABELS: Record<string, string> = {
  CANDIDATE: "후보",
  SELECTED: "선택됨",
  IN_PROGRESS: "진행 중",
  DONE: "완료",
  DISMISSED: "제외",
};

export const THREADS_VARIANT_LABELS: Record<string, string> = {
  INFO: "정보형",
  OBSERVATION: "운영자 관찰형",
  ENGAGEMENT: "참여형",
};
