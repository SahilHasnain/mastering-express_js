const uploadToS3 = async (file) => {
  // Step 1: Ask backend for a signed URL
  const res = await fetch(
    `http://localhost:5000/generate-upload-url?filename=${file.name}&filetype=${file.type}`
  );
  const data = await res.json();

  const { uploadUrl, key } = data;

  // Step 2: Upload directly to S3
  await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type
    },
    body: file // <-- direct S3 upload
  });

  return {
    key,
    url: `https://${process.env.NEXT_PUBLIC_BUCKET}.s3.${process.env.NEXT_PUBLIC_REGION}.amazonaws.com/${key}`
  };
};
