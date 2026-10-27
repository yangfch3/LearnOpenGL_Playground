#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec3 aNormal;
layout (location = 2) in vec2 aTexCoords;
layout (location = 3) in vec3 aTangent;
layout (location = 4) in vec3 aBitangent;

// 法线贴图里的法线定义在「切线空间」：z 轴 = 表面法线，x/y 轴 = UV 的 u/v 方向。
// 这样同一张贴图可贴在任意朝向的表面上。光照要求所有向量在同一空间，两种做法：
//   A. FS 中用 TBN 把贴图法线变到世界空间（每像素一次 mat3 乘法）
//   B. VS 中用 TBN 的逆把光源/相机/片段位置变到切线空间（每顶点一次，FS 直接用贴图法线）
// 这里用 B：顶点数远少于像素数，更省
out VS_OUT {
    vec3 FragPos;
    vec2 TexCoords;
    vec3 TangentLightPos;
    vec3 TangentViewPos;
    vec3 TangentFragPos;
} vs_out;

uniform mat4 projection;
uniform mat4 view;
uniform mat4 model;

uniform vec3 lightPos;
uniform vec3 viewPos;

void main()
{
    vs_out.FragPos = vec3(model * vec4(aPos, 1.0));
    vs_out.TexCoords = aTexCoords;

    // 法线矩阵 = model 左上 3x3 的逆转置，保证非均匀缩放下法线仍垂直于表面；
    // 切线是表面内的方向，严格应使用 mat3(model) 变换；本例 model 只有旋转/均匀缩放，两者等价（沿用原教程写法）。
    // 实际项目应在 CPU 端算好法线矩阵传入，inverse 每顶点算一次很贵
    mat3 normalMatrix = transpose(inverse(mat3(model)));
    vec3 T = normalize(normalMatrix * aTangent);
    vec3 N = normalize(normalMatrix * aNormal);
    // Gram-Schmidt：顶点切线常是相邻面平均值，与 N 不再严格垂直；减去 T 在 N 上的投影即可
    T = normalize(T - dot(T, N) * N);
    // B 用叉乘重建，aBitangent 不再需要。
    // 注意：UV 镜像的网格 B 方向会反，工业做法是切线存 vec4，w = ±1 记录手性
    vec3 B = cross(N, T);

    // mat3(T, B, N) 以三列构成「切线 -> 世界」矩阵；它是正交矩阵，转置即逆，得到「世界 -> 切线」
    mat3 TBN = transpose(mat3(T, B, N));
    vs_out.TangentLightPos = TBN * lightPos;
    vs_out.TangentViewPos  = TBN * viewPos;
    vs_out.TangentFragPos  = TBN * vs_out.FragPos;

    gl_Position = projection * view * model * vec4(aPos, 1.0);
}
