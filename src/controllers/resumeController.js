// File: src/controllers/resumeController.js
import prisma from '../config/database.js';
import { ApiError } from '../middleware/errorHandler.js';

export async function handleResumeUpload(req, res, next) {
  try {
    if (!req.file) {
      throw new ApiError(400, 'No resume file uploaded');
    }

    const candidateProfile = await prisma.candidateProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (!candidateProfile) {
      throw new ApiError(404, 'Candidate profile not found');
    }

    const resume = await prisma.resume.create({
      data: {
        candidateId: candidateProfile.id,
        originalFileName: req.file.originalname,
        storedFileName: req.file.filename,
        fileUrl: `/uploads/${req.file.filename}`,
        mimeType: req.file.mimetype,
        fileSizeBytes: req.file.size,
        status: 'PENDING',
      },
    });

    res.status(201).json({
      success: true,
      message: 'Resume uploaded successfully',
      data: resume,
    });
  } catch (error) {
    next(error);
  }
}

export async function getCandidateResumes(req, res, next) {
  try {
    const candidateProfile = await prisma.candidateProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (!candidateProfile) {
      throw new ApiError(404, 'Candidate profile not found');
    }

    const resumes = await prisma.resume.findMany({
      where: { candidateId: candidateProfile.id },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      success: true,
      data: resumes,
    });
  } catch (error) {
    next(error);
  }
}