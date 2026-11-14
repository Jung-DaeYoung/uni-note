FROM eclipse-temurin:21-jdk AS build
WORKDIR /workspace

COPY gradlew gradlew.bat build.gradle settings.gradle ./
COPY gradle gradle
# gradlew가 Git에 실행 권한 없이(100644) 등록되어 있다.
RUN chmod +x gradlew
RUN ./gradlew dependencies --no-daemon

COPY src src
RUN ./gradlew bootJar --no-daemon

FROM eclipse-temurin:21-jre
WORKDIR /app

RUN mkdir -p /app/uploads
COPY --from=build /workspace/build/libs/*.jar app.jar

EXPOSE 8080
# 컨테이너 기본 시간대는 UTC다. LocalDateTime·Clock이 KST로 동작하도록 JVM 시간대를 고정한다.
ENTRYPOINT ["java", "-Duser.timezone=Asia/Seoul", "-jar", "/app/app.jar"]
