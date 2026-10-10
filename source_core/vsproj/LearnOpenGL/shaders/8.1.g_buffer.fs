#version 330 core
// 输出到颜色附件 0：片段位置
layout (location = 0) out vec3 gPosition;
// 输出到颜色附件 1：片段法线
layout (location = 1) out vec3 gNormal;
// 输出到颜色附件 2：漫反射颜色 + 高光强度
layout (location = 2) out vec4 gAlbedoSpec;

// 从顶点着色器传来的纹理坐标
in vec2 TexCoords;
// 从顶点着色器传来的片段位置
in vec3 FragPos;
// 从顶点着色器传来的法线
in vec3 Normal;

// 漫反射纹理
uniform sampler2D texture_diffuse1;
// 高光纹理
uniform sampler2D texture_specular1;

void main()
{    
    // store the fragment position vector in the first gbuffer texture
    // 把片段位置写入 G-buffer 的第一个纹理
    gPosition = FragPos;
    // also store the per-fragment normals into the gbuffer
    // 把归一化后的法线写入 G-buffer
    gNormal = normalize(Normal);
    // and the diffuse per-fragment color
    // 把漫反射颜色写入 gAlbedoSpec 的 rgb 通道
    gAlbedoSpec.rgb = texture(texture_diffuse1, TexCoords).rgb;
    // store specular intensity in gAlbedoSpec's alpha component
    // 把高光强度写入 gAlbedoSpec 的 alpha 通道
    gAlbedoSpec.a = texture(texture_specular1, TexCoords).r;
}