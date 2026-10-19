import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { mockDb } from '../lib/mockStore';
import { DocumentItem, DocumentComment } from '../data/schemaData';

export interface UseDocumentReviewResult {
  loading: boolean;
  error: string | null;
  data: {
    documents: DocumentItem[];
    comments: DocumentComment[];
  };
  refetch: () => void;
  uploadDocument: (fileUrl: string, tenantId: string) => Promise<DocumentItem>;
  updateDocumentStatus: (docId: string, status: DocumentItem['status']) => Promise<void>;
  addComment: (docId: string, comment: string, tenantId: string, userId: string, userName: string) => Promise<void>;
}

export function useDocumentReview(taskId: string): UseDocumentReviewResult {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [comments, setComments] = useState<DocumentComment[]>([]);

  // Main data fetch function
  const fetchData = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    setError(null);

    try {
      if (mockDb.isSupabaseConfigured()) {
        // 1. Real Supabase Client logic
        const { data: docData, error: docError } = await supabase
          .from('documents')
          .select('*')
          .eq('task_id', taskId)
          .order('created_at', { ascending: true });

        if (docError) throw docError;

        // Fetch comments for all fetched documents
        const docIds = (docData || []).map(d => d.id);
        let commentsData: any[] = [];
        
        if (docIds.length > 0) {
          const { data: commData, error: commError } = await supabase
            .from('document_comments')
            .select('*, users(name)')
            .in('document_id', docIds)
            .order('created_at', { ascending: true });

          if (commError) throw commError;
          commentsData = commData || [];
        }

        // Map comments to include user names
        const mappedComments: DocumentComment[] = commentsData.map(c => ({
          id: c.id,
          tenant_id: c.tenant_id,
          document_id: c.document_id,
          user_id: c.user_id,
          user_name: c.users?.name || 'User Tidak Dikenal',
          comment: c.comment,
          created_at: c.created_at
        }));

        setDocuments(docData || []);
        setComments(mappedComments);
      } else {
        // 2. Reactive local mock data fallback
        await mockDb.delay(150);
        const docs = mockDb.documents.filter(d => d.task_id === taskId);
        const docIds = docs.map(d => d.id);
        const comps = mockDb.comments.filter(c => docIds.includes(c.document_id));

        setDocuments([...docs]);
        setComments([...comps]);
      }
    } catch (err: any) {
      console.error('Error fetching document review data:', err);
      setError(err.message || 'Gagal mengambil draf dokumen & diskusi komentar');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  // Action: Create document metadata entry after mock/real storage upload
  const uploadDocument = useCallback(async (fileUrl: string, tenantId: string): Promise<DocumentItem> => {
    setLoading(true);
    setError(null);
    try {
      if (mockDb.isSupabaseConfigured()) {
        const { data, error: insertError } = await supabase
          .from('documents')
          .insert({
            tenant_id: tenantId,
            task_id: taskId,
            file_url: fileUrl,
            status: 'DRAFT'
          })
          .select()
          .single();

        if (insertError) throw insertError;
        await fetchData();
        return data;
      } else {
        const newDoc = await mockDb.uploadDocument(taskId, tenantId, fileUrl);
        await fetchData();
        return newDoc;
      }
    } catch (err: any) {
      console.error('Error uploading document review:', err);
      setError(err.message || 'Gagal mengunggah dokumen baru');
      setLoading(false);
      throw err;
    }
  }, [taskId, fetchData]);

  // Action: Approve or request rewrite on a document
  const updateDocumentStatus = useCallback(async (docId: string, status: DocumentItem['status']) => {
    setLoading(true);
    setError(null);
    try {
      if (mockDb.isSupabaseConfigured()) {
        const { error: updateError } = await supabase
          .from('documents')
          .update({ status })
          .eq('id', docId);

        if (updateError) throw updateError;
        await fetchData();
      } else {
        await mockDb.updateDocumentStatus(docId, status);
        await fetchData();
      }
    } catch (err: any) {
      console.error('Error updating document status:', err);
      setError(err.message || 'Gagal merubah status verifikasi dokumen');
      setLoading(false);
      throw err;
    }
  }, [fetchData]);

  // Action: Add comment on a document
  const addComment = useCallback(async (
    docId: string,
    commentText: string,
    tenantId: string,
    userId: string,
    userName: string
  ) => {
    if (!commentText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      if (mockDb.isSupabaseConfigured()) {
        const { error: insertError } = await supabase
          .from('document_comments')
          .insert({
            tenant_id: tenantId,
            document_id: docId,
            user_id: userId,
            comment: commentText
          });

        if (insertError) throw insertError;
        await fetchData();
      } else {
        await mockDb.addComment(docId, tenantId, userId, userName, commentText);
        await fetchData();
      }
    } catch (err: any) {
      console.error('Error posting revision comment:', err);
      setError(err.message || 'Gagal mengirimkan komentar revisi');
      setLoading(false);
      throw err;
    }
  }, [fetchData]);

  // Handle initialization and automatic reactivity
  useEffect(() => {
    fetchData();

    // Subscribe to reactive local mock changes to keep all active UI synchronised
    const unsubscribe = mockDb.subscribe(() => {
      fetchData();
    });

    return () => {
      unsubscribe();
    };
  }, [taskId, fetchData]);

  return {
    loading,
    error,
    data: {
      documents,
      comments
    },
    refetch: fetchData,
    uploadDocument,
    updateDocumentStatus,
    addComment
  };
}
