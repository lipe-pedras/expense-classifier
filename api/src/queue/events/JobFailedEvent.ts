export interface JobFailedEvent {
  jobId: string;
  documentId: string;
  userId: string;
  reason: string;
}
