#version 330 core
// 输出颜色
out vec4 FragColor;

// 从顶点着色器传来的纹理坐标
in vec2 TexCoords;

// 输入图像纹理
uniform sampler2D image;

// 是否做水平方向模糊
uniform bool horizontal;
// 高斯权重数组，共 5 个
uniform float weight[5] = float[] (0.2270270270, 0.1945945946, 0.1216216216, 0.0540540541, 0.0162162162);

void main()
{             
     // 计算一个纹素的大小
     vec2 tex_offset = 1.0 / textureSize(image, 0); // gets size of single texel
     // 中心像素乘以最大权重
     vec3 result = texture(image, TexCoords).rgb * weight[0];
     // 如果是水平方向模糊
     if(horizontal)
     {
         // 遍历权重索引 1 到 4
         for(int i = 1; i < 5; ++i)
         {
            // 采样右侧像素并加权
            result += texture(image, TexCoords + vec2(tex_offset.x * i, 0.0)).rgb * weight[i];
            // 采样左侧像素并加权
            result += texture(image, TexCoords - vec2(tex_offset.x * i, 0.0)).rgb * weight[i];
         }
     }
     // 如果是垂直方向模糊
     else
     {
         // 遍历权重索引 1 到 4
         for(int i = 1; i < 5; ++i)
         {
             // 采样上方像素并加权
             result += texture(image, TexCoords + vec2(0.0, tex_offset.y * i)).rgb * weight[i];
             // 采样下方像素并加权
             result += texture(image, TexCoords - vec2(0.0, tex_offset.y * i)).rgb * weight[i];
         }
     }
     // 输出模糊后的颜色
     FragColor = vec4(result, 1.0);
}